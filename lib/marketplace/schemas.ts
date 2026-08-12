import { z } from "zod";

export const discoverFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  specialty: z.string().trim().max(50).optional(),
  mode: z.enum(["online", "in_person", "hybrid"]).optional(),
  city: z.string().trim().max(100).optional(),
});
export type DiscoverFilters = z.infer<typeof discoverFiltersSchema>;

export const applyToPackageSchema = z.object({
  packageId: z.string().uuid(),
});
export type ApplyToPackageInput = z.infer<typeof applyToPackageSchema>;
