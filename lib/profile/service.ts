import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, coachProfiles } from "@/lib/db/schema/identity";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProfileError = { code: "unsupported_file_type" } | { code: "file_too_large"; maxMb: number } | { code: "upload_failed" };
export type ProfileResult<T> = { ok: true; data: T } | { ok: false; error: ProfileError };
function ok<T>(data: T): ProfileResult<T> {
  return { ok: true, data };
}
function fail<T>(error: ProfileError): ProfileResult<T> {
  return { ok: false, error };
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_AVATAR_MB = 5;

export async function uploadAvatar(userId: string, file: File): Promise<ProfileResult<{ url: string }>> {
  if (!IMAGE_TYPES.has(file.type)) return fail({ code: "unsupported_file_type" });
  if (file.size > MAX_AVATAR_MB * 1024 * 1024) return fail({ code: "file_too_large", maxMb: MAX_AVATAR_MB });

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return fail({ code: "upload_failed" });

  const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
  await db.update(users).set({ avatarUrl: publicUrl.publicUrl }).where(eq(users.id, userId));
  return ok({ url: publicUrl.publicUrl });
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  await db.update(users).set({ displayName }).where(eq(users.id, userId));
}

const MAX_COVER_MB = 8;

export async function uploadCoachCoverPhoto(coachId: string, file: File): Promise<ProfileResult<{ url: string }>> {
  if (!IMAGE_TYPES.has(file.type)) return fail({ code: "unsupported_file_type" });
  if (file.size > MAX_COVER_MB * 1024 * 1024) return fail({ code: "file_too_large", maxMb: MAX_COVER_MB });

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${coachId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return fail({ code: "upload_failed" });

  const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
  await db.update(coachProfiles).set({ coverPhotoUrl: publicUrl.publicUrl }).where(eq(coachProfiles.id, coachId));
  return ok({ url: publicUrl.publicUrl });
}
