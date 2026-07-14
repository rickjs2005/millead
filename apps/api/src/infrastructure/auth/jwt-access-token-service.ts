import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type {
  AccessTokenClaims,
  AccessTokenService,
} from "../../domain/services/access-token-service.js";

export class JwtAccessTokenService implements AccessTokenService {
  sign(claims: AccessTokenClaims): string {
    return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_TTL,
    } as jwt.SignOptions);
  }

  verify(token: string): AccessTokenClaims | null {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      if (typeof decoded === "string") return null;
      const { sub, organizationId } = decoded;
      if (typeof sub !== "string" || typeof organizationId !== "string") return null;
      return { sub, organizationId };
    } catch {
      return null;
    }
  }
}
