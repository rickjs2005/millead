import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Encapsula um handler async pra erros caírem no `errorHandler` via `next()`. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
