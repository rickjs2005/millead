/**
 * Erros de domínio/aplicação, independentes de HTTP -- o middleware de
 * erro (interfaces/http) é quem sabe traduzir cada um pro status code
 * certo. Use-cases e repositórios nunca importam Express.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";
}

export class ValidationError extends AppError {
  readonly statusCode = 422;
  readonly code = "VALIDATION_ERROR";

  constructor(
    message: string,
    readonly issues?: unknown,
  ) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = "FORBIDDEN";
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";
}

/** IA sem chave configurada -- 503 com mensagem acionável, não um 500. */
export class AiNotConfiguredError extends AppError {
  readonly statusCode = 503;
  readonly code = "AI_NOT_CONFIGURED";

  constructor() {
    super(
      "Os recursos de IA não estão configurados. Defina ANTHROPIC_API_KEY no .env e reinicie a API.",
    );
  }
}
