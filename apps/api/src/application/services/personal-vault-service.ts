import type { PersonalVaultStatus } from "../../domain/entities/personal-vault.js";
import { NotFoundError, UnauthorizedError } from "../../domain/errors/app-error.js";
import type { PersonalVaultRepository } from "../../domain/repositories/personal-vault-repository.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
import type { PasswordHasher } from "../../domain/services/password-hasher.js";
import type { VaultLocker } from "../../domain/services/vault-locker.js";
import type { VaultProvisioner } from "../../domain/services/vault-provisioner.js";
import type { VaultSessionService } from "../../domain/services/vault-session-service.js";
import type { AuditContext, AuditLogger } from "./audit-logger.js";
import { attemptsRemaining, isLocked, lockoutFor } from "./vault-lockout.js";

/**
 * Mensagem única pra "não é seu", "não existe" e "o módulo está desligado".
 * A resposta é sempre 404 e sempre igual: quem não deveria estar ali não
 * aprende se o Cofre existe, se pertence a outra pessoa ou se foi desativado.
 */
const NOT_FOUND = "Rota não encontrada.";

export interface UnlockedSession {
  token: string;
  expiresInSeconds: number;
}

export class PersonalVaultService implements VaultLocker {
  constructor(
    private readonly vaults: PersonalVaultRepository,
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessions: VaultSessionService,
    private readonly audit: AuditLogger,
    private readonly provisioner: VaultProvisioner,
  ) {}

  /** Contexto de auditoria do Cofre: `organizationId` SEMPRE null. O Cofre não
   *  pertence à organização, e carimbar uma aqui colocaria a atividade
   *  pessoal na trilha da empresa. */
  private auditContext(ctx: AuditContext): AuditContext {
    return { ...ctx, organizationId: null };
  }

  /**
   * Estado da tela bloqueada. 404 pra quem não tem Cofre -- é a mesma resposta
   * que o resto do módulo dá, então "existe mas está fechado" e "não existe"
   * ficam indistinguíveis de fora.
   */
  async status(userId: string): Promise<PersonalVaultStatus> {
    const vault = await this.requireVaultOf(userId);
    const now = new Date();
    return {
      enabled: vault.enabled,
      lockedUntil: isLocked(vault, now) ? vault.lockedUntil : null,
      attemptsRemaining: attemptsRemaining(vault.failedAttempts),
    };
  }

  /**
   * Cria o Cofre do usuário autenticado. O dono é sempre quem está logado --
   * não existe parâmetro de dono, então não existe request que crie Cofre no
   * nome de outra pessoa.
   */
  async create(userId: string, ctx: AuditContext): Promise<{ created: boolean }> {
    const vault = await this.vaults.create(userId);

    // Semeia SEMPRE, inclusive quando o Cofre já existia. É idempotente, e
    // torna a operação auto-corretiva: se o provisionamento falhou numa
    // tentativa anterior (rede, timeout), a próxima chamada conserta em vez de
    // deixar um Cofre sem categoria nenhuma e sem caminho de volta.
    const target = vault ?? (await this.vaults.findByOwner(userId));
    if (!target) throw new NotFoundError(NOT_FOUND);
    await this.provisioner.seedDefaults(target.id);

    if (!vault) return { created: false }; // já tinha um; idempotente de propósito
    await this.audit.log(this.auditContext(ctx), "vault.created", {
      entityType: "personal_vault",
      entityId: vault.id,
    });
    return { created: true };
  }

  /**
   * Reautenticação. Erro de senha e Cofre bloqueado respondem 401 com a mesma
   * mensagem -- contar "faltam N tentativas" na resposta de erro ajudaria mais
   * quem está atacando do que quem esqueceu a senha (o dono vê o contador na
   * tela, que consulta `status`).
   */
  async unlock(userId: string, password: string, ctx: AuditContext): Promise<UnlockedSession> {
    const vault = await this.requireVaultOf(userId);
    const now = new Date();

    if (isLocked(vault, now)) {
      await this.audit.log(this.auditContext(ctx), "vault.unlock_blocked", {
        entityType: "personal_vault",
        entityId: vault.id,
      });
      throw new UnauthorizedError("Cofre temporariamente bloqueado. Tente novamente mais tarde.");
    }

    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError(NOT_FOUND);

    const ok = await this.passwordHasher.compare(password, user.passwordHash);
    if (!ok) {
      // Incremento atômico no banco: tentativas em paralelo não se
      // sobrescrevem (ver incrementFailedAttempts).
      const failed = await this.vaults.incrementFailedAttempts(userId);
      const lockedUntil = lockoutFor(failed, now);
      if (lockedUntil) await this.vaults.setLockedUntil(userId, lockedUntil);

      await this.audit.log(this.auditContext(ctx), "vault.unlock_failed", {
        entityType: "personal_vault",
        entityId: vault.id,
        // Só o contador e se travou -- nenhum valor, descrição ou dado do Cofre.
        metadata: { failedAttempts: failed, locked: lockedUntil !== null },
      });
      throw new UnauthorizedError("Senha incorreta.");
    }

    await this.vaults.registerSuccessfulUnlock(userId, now);
    await this.audit.log(this.auditContext(ctx), "vault.unlocked", {
      entityType: "personal_vault",
      entityId: vault.id,
    });

    return this.sessions.sign({ ownerUserId: userId, vaultId: vault.id });
  }

  /**
   * "Bloquear agora". Corta as sessões elevadas no servidor em vez de só
   * limpar o cookie do navegador: um token já emitido (copiado de um
   * dispositivo perdido, por exemplo) seguiria valendo pelos minutos
   * restantes se o botão fosse só cosmético.
   */
  async lock(userId: string, ctx: AuditContext): Promise<void> {
    const vault = await this.requireVaultOf(userId);
    await this.vaults.invalidateSessions(userId, new Date());
    await this.audit.log(this.auditContext(ctx), "vault.locked", {
      entityType: "personal_vault",
      entityId: vault.id,
    });
  }

  /**
   * Fechamento automático no logout. Best-effort e silencioso: quem não tem
   * Cofre sai normalmente, e uma falha aqui não pode impedir alguém de
   * encerrar a própria sessão.
   */
  async lockOnLogout(userId: string): Promise<void> {
    try {
      const vault = await this.vaults.findByOwner(userId);
      if (!vault) return;
      await this.vaults.invalidateSessions(userId, new Date());
    } catch {
      // logout nunca falha por causa do Cofre
    }
  }

  private async requireVaultOf(userId: string) {
    const vault = await this.vaults.findByOwner(userId);
    // `enabled: false` cai no mesmo 404 que "não existe" -- ver NOT_FOUND.
    if (!vault || !vault.enabled) throw new NotFoundError(NOT_FOUND);
    return vault;
  }
}
