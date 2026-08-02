import type { Request, Response } from "express";
import type { SocialService } from "../../../application/services/social-service.js";
import type { SetFormatInput } from "../../../application/dto/social.dto.js";

export class SocialController {
  constructor(private readonly social: SocialService) {}

  sync = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.sync());
  };
  listPosts = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.listPosts());
  };
  series = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.getSeries(req.params.id!));
  };
  setFormat = async (req: Request, res: Response): Promise<void> => {
    const { format } = req.body as SetFormatInput;
    res.status(200).json(await this.social.setFormat(req.params.id!, format));
  };
  comparison = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.getComparison());
  };
  analysis = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.generateAnalysis());
  };
}
