import Link from "next/link";
import { discoverFiltersSchema } from "@/lib/marketplace/schemas";
import { searchCoaches } from "@/lib/marketplace/service";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = discoverFiltersSchema.safeParse({
    q: typeof params.q === "string" ? params.q : undefined,
    specialty: typeof params.specialty === "string" ? params.specialty : undefined,
    mode: typeof params.mode === "string" ? params.mode : undefined,
    city: typeof params.city === "string" ? params.city : undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const coaches = await searchCoaches(filters);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Discover a coach</h1>
      <p className="mt-2 text-sm text-muted-foreground">Search by goal, specialty, mode, or city.</p>

      <form className="mt-6 flex flex-wrap gap-2" action="/discover">
        <input
          type="text"
          name="q"
          defaultValue={filters.q}
          placeholder="Search by name or headline"
          className="h-9 min-w-[200px] flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <select name="mode" defaultValue={filters.mode ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">Any mode</option>
          <option value="online">Online</option>
          <option value="in_person">In person</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <input
          type="text"
          name="city"
          defaultValue={filters.city}
          placeholder="City"
          className="h-9 w-32 rounded-md border bg-background px-3 text-sm"
        />
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Search
        </button>
      </form>

      <div className="mt-8 flex flex-col gap-4">
        {coaches.length === 0 && (
          <p className="text-sm text-muted-foreground">No coaches match those filters yet.</p>
        )}
        {coaches.map((coach) => (
          <Link
            key={coach.handle}
            href={`/c/${coach.handle}`}
            className="rounded-lg border p-4 transition-colors hover:border-primary"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{coach.displayName}</span>
              {coach.ratingCount > 0 && (
                <span className="text-xs text-muted-foreground">{coach.ratingAvg} ★ ({coach.ratingCount})</span>
              )}
            </div>
            {coach.headline && <p className="mt-1 text-sm text-muted-foreground">{coach.headline}</p>}
            <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {coach.city && <span>{[coach.city, coach.country].filter(Boolean).join(", ")}</span>}
              {coach.specialties && coach.specialties.length > 0 && <span>{coach.specialties.join(", ").replace(/_/g, " ")}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
