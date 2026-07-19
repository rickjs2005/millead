import { Prisma } from "@millead/database";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../../../domain/errors/app-error.js";
import { logger } from "../../../config/logger.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, issues: (err as { issues?: unknown }).issues },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: "Dados inválidos.", issues: err.issues },
    });
    return;
  }

  // P2002: violação de constraint única -- duas requisições concorrentes
  // (ex.: registro duas vezes com o mesmo e-mail) passam pela checagem
  // "já existe?" da aplicação antes de qualquer uma commitar; a segunda
  // esbarra aqui, no banco, que é a fonte de verdade real. Isso vira um
  // 409 legível em vez de um 500 genérico.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    // `err.meta` carrega o alvo da constraint (nomes de coluna/índice
    // internos) -- fica só no log do servidor, nunca na resposta, pra não
    // vazar detalhe de schema pra chamadores não autenticados (ex.: form
    // público de contrato batendo num unique de documento/e-mail).
    logger.warn({ meta: err.meta, path: req.path }, "conflito de constraint única (P2002)");
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "Já existe um registro com esses dados.",
      },
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, "erro não tratado");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor." } });
};
