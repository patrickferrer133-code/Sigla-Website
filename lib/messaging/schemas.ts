import { z } from "zod";

export const sendMessageSchema = z.object({
  engagementId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
