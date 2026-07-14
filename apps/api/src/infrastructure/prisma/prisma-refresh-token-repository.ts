import { prisma } from "@millead/database";
import type { NewRefreshToken, RefreshToken } from "../../domain/entities/refresh-token.js";
import type { RefreshTokenRepository } from "../../domain/repositories/refresh-token-repository.js";

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  async create(input: NewRefreshToken): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data: input });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revoke(id: string): Promise<boolean> {
    // updateMany (não update) de propósito: a condição extra `revokedAt:
    // null` no WHERE é o que torna isso atômico -- se duas requisições
    // chegarem aqui ao mesmo tempo pro mesmo token, o Postgres serializa
    // as duas UPDATEs e só a primeira encontra a linha ainda não revogada
    // (count 1); a segunda encontra 0 linhas (já revogada por essa altura),
    // sem nenhuma corrida possível entre "ler o estado" e "escrever".
    const result = await prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async setReplacedBy(id: string, replacedByTokenId: string): Promise<void> {
    await prisma.refreshToken.update({ where: { id }, data: { replacedByTokenId } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
