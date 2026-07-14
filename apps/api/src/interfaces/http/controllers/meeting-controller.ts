import type { Request, Response } from "express";
import type { ListMeetingsQuery } from "../../../application/dto/meeting.dto.js";
import type { MeetingService } from "../../../application/services/meeting-service.js";
import { requireAuth } from "../require-auth.js";

export class MeetingController {
  constructor(private readonly meetings: MeetingService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const meeting = await this.meetings.create(auth.organizationId, auth.userId, req.body);
    res.status(201).json(meeting);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, ...filters } = req.validatedQuery as ListMeetingsQuery;
    const result = await this.meetings.list(auth.organizationId, filters, { page, pageSize });
    res.status(200).json(result);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const meeting = await this.meetings.get(auth.organizationId, req.params.id!);
    res.status(200).json(meeting);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const meeting = await this.meetings.update(auth.organizationId, req.params.id!, req.body);
    res.status(200).json(meeting);
  };

  addAttendee = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const attendee = await this.meetings.addAttendee(auth.organizationId, req.params.id!, req.body);
    res.status(201).json(attendee);
  };

  removeAttendee = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.meetings.removeAttendee(auth.organizationId, req.params.id!, req.params.attendeeId!);
    res.status(204).send();
  };
}
