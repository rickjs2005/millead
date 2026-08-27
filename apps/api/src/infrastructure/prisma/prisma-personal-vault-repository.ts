import { Prisma, prisma } from "@millead/database";
import type { PersonalVault } from "../../domain/entities/personal-vault.js";
import type { PersonalVaultRepository } from "../../domain/repositories/personal-vault-repository.js";

const vaultSelect = {
  id: true,
  ownerUserId: true,
  enabled: true,
  failedAttempts: true,
  lockedUntil: true,
  lastUnlockedAt: true,
  sessionsInvalidatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaPersonalVaultRepository implements PersonalVaultRepository {
  async findByOwner(ownerUserId: string): Promise<PersonalVault | null> {
    return prisma.personalVault.findUnique({ where: { ownerUserId }, select: vaultSelect });
  }

  async create(ownerUserId: string): Promise<PersonalVault | null> {
    try {
      return await prisma.personalVault.create({ data: { ownerUserId }, select: vaultSelect });
    } catch (err) {
      // P2002 = o unique de owner_user_id. Quem decide "já existe" é o banco,
      // não uma leitura anterior: duas requisições concorrentes passariam as
      // duas por um `findByOwner` vazio antes de qualquer uma commitar.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return null;
      }
      throw err;
    }
  }

  async incrementFailedAttempts(ownerUserId: string): Promise<number> {
    const updated = await prisma.personalVault.update({
      where: { ownerUserId },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true },
    });
    return updated.failedAttempts;
  }

  async setLockedUntil(ownerUserId: string, lockedUntil: Date | null): Promise<void> {
    await prisma.personalVault.update({ where: { ownerUserId }, data: { lockedUntil } });
  }

  async registerSuccessfulUnlock(ownerUserId: string, unlockedAt: Date): Promise<void> {
    await prisma.personalVault.update({
      where: { ownerUserId },
      // `sessionsInvalidatedAt: null` junto: um desbloqueio bem-sucedido
      // supera qualquer corte anterior. Sem isso, bloquear e reabrir dentro do
      // mesmo segundo devolveria um token que o próprio corte recusa (o `iat`
      // do JWT tem resolução de segundos, o corte tem de milissegundos).
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastUnlockedAt: unlockedAt,
        sessionsInvalidatedAt: null,
      },
    });
  }

  async invalidateSessions(ownerUserId: string, at: Date): Promise<void> {
    await prisma.personalVault.update({
      where: { ownerUserId },
      data: { sessionsInvalidatedAt: at },
    });
  }
}
