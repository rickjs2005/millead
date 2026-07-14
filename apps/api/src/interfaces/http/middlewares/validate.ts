import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../../../domain/errors/app-error.js";

/** Valida `req.body` contra um schema Zod e substitui pelo dado já parseado/tipado. */
export function validateBody(schema: ZodSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError("Dados inválidos.", result.error.issues));
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Valida `req.query` e guarda o resultado em `req.validatedQuery` (não
 * sobrescreve `req.query` -- o tipo `ParsedQs` do Express não bate com o
 * shape já convertido pelo Zod, ex.: `page` vira number, não string).
 */
export function validateQuery(schema: ZodSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError("Parâmetros inválidos.", result.error.issues));
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
}
