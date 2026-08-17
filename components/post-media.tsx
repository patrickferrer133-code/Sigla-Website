export function PostMediaDisplay({ media }: { media: { type: "image" | "video"; url: string } | null }) {
  if (!media) return null;

  if (media.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not worth next/image config for coach-uploaded content
    return <img src={media.url} alt="" className="max-h-96 w-full rounded-xl object-cover" />;
  }

  return (
    <video controls className="max-h-96 w-full rounded-xl" preload="metadata">
      <source src={media.url} />
    </video>
  );
}
