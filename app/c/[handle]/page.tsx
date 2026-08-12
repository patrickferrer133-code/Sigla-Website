export default async function CoachPublicPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">@{handle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This coach&apos;s public page — bio, credentials, packages, and posts — is coming in a later phase.
      </p>
    </div>
  );
}
