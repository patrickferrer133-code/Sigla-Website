"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { announcementIdSchema, saveAnnouncementSchema } from "@/lib/announcements/schemas";
import {
  createAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
} from "@/lib/announcements/service";

export type AnnouncementFormState = { status: "idle" } | { status: "error"; message: string } | { status: "saved" };

export async function createAnnouncementAction(
  _prevState: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const user = await requireRole("admin");

  const parsed = saveAnnouncementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    audience: formData.get("audience") ?? "all",
  });
  if (!parsed.success) return { status: "error", message: "Double check the fields." };

  const result = await createAnnouncement(user.id, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not save. Try again." };

  revalidatePath("/admin/news");
  return { status: "saved" };
}

export async function togglePublishAction(announcementId: string, publish: boolean, _formData: FormData) {
  await requireRole("admin");

  const parsed = announcementIdSchema.safeParse({ announcementId });
  if (!parsed.success) return;

  await (publish ? publishAnnouncement(parsed.data.announcementId) : unpublishAnnouncement(parsed.data.announcementId));
  revalidatePath("/admin/news");
  revalidatePath("/coach");
  revalidatePath("/client");
}

export async function deleteAnnouncementAction(announcementId: string, _formData: FormData) {
  await requireRole("admin");

  const parsed = announcementIdSchema.safeParse({ announcementId });
  if (!parsed.success) return;

  await deleteAnnouncement(parsed.data.announcementId);
  revalidatePath("/admin/news");
  revalidatePath("/coach");
  revalidatePath("/client");
}
