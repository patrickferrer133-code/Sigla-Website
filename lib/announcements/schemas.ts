import { z } from "zod";

export const announcementAudiences = ["all", "coaches", "clients"] as const;

export const saveAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(4000),
  audience: z.enum(announcementAudiences).default("all"),
});
export type SaveAnnouncementInput = z.infer<typeof saveAnnouncementSchema>;

export const announcementIdSchema = z.object({
  announcementId: z.string().uuid(),
});
export type AnnouncementIdInput = z.infer<typeof announcementIdSchema>;
