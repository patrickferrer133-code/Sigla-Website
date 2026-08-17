import { z } from "zod";

export const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
});
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
