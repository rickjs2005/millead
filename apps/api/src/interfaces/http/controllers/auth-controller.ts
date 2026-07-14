import type { Request, Response } from "express";
import type { GetCurrentUserUseCase } from "../../../application/use-cases/auth/get-current-user-use-case.js";
import type { LoginUseCase } from "../../../application/use-cases/auth/login-use-case.js";
import type { LogoutUseCase } from "../../../application/use-cases/auth/logout-use-case.js";
import type { RefreshUseCase } from "../../../application/use-cases/auth/refresh-use-case.js";
import type { RegisterUseCase } from "../../../application/use-cases/auth/register-use-case.js";
import { getRequestMeta } from "../request-meta.js";
import { requireAuth } from "../require-auth.js";

export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.registerUseCase.execute(req.body, getRequestMeta(req));
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.loginUseCase.execute(req.body, getRequestMeta(req));
    res.status(200).json(result);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const result = await this.refreshUseCase.execute(req.body, getRequestMeta(req));
    res.status(200).json(result);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await this.logoutUseCase.execute(req.body, getRequestMeta(req));
    res.status(204).send();
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.getCurrentUserUseCase.execute(auth.userId, auth.organizationId);
    res.status(200).json(result);
  };
}
