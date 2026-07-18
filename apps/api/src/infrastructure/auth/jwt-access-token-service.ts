import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type {
  AccessTokenClaims,
  AccessTokenService,
} from "../../domain/services/access-token-service.js";

// Segredo simétrico -> HMAC-SHA256. Fixar o algoritmo (não deixar a lib
// inferir do header do token) fecha a classe de ataques de confusão de
// algoritmo por boa prática, mesmo que a lib já rejeite `alg:none`.
const ALGORITHM = "HS256" as const;

export class JwtAccessTokenService implements AccessTokenService {
  sign(claims: AccessTokenClaims): string {
    return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_TTL,
      algorithm: ALGORITHM,
    } as jwt.SignOptions);
  }

  verify(token: string): AccessTokenClaims | null {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [ALGORITHM] });
      if (typeof decoded === "string") return null;
      const { sub, organizationId } = decoded;
      if (typeof sub !== "string" || typeof organizationId !== "string") return null;
      return { sub, organizationId };
    } catch {
      return null;
    }
  }
}
