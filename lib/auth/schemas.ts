import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
  // Admin accounts are not self-serve — created directly in the database.
  role: z.enum(["coach", "client"]),
  // docs/06 section 6: minimum account age is 18, age-gated at signup.
  ageAttestation: z.literal("on", { message: "You must confirm you are 18 or older." }),
});
