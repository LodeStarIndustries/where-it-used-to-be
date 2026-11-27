import Link from "next/link";
import { Suspense } from "react";
import { sitesNear } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { signedPhotoUrl } from "@/lib/photos";
import { pendingSubmissions, placeChoices, reviewedSubmissions } from "@/lib/submissions/data";
import { SubmissionCard } from "@/components/admin/SubmissionCard";
import { AdminCard, Pill } from "@/components/admin/ui";

async function Queue({ searchParams }: { searchParams: PageProps<"/admin/submissions">["searchParams"] }) {
  await requireAdminPage("/admin/submissions");
  const view = (await searchParams).view === "reviewed" ? "reviewed" : "pending";

  if (view === "reviewed") {
    const done = await reviewedSubmissions();
    return (
      <AdminCard title="Reviewed (latest 50)">
        {done.length === 0 ? (
          <p className="text-[14px] text-body">Nothing reviewed yet.</p>
        ) : (
          <ul className="divide-y divide-divider-soft">
            {done.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[14px]">
                <span>
                  <strong className="text-ink">{s.businessName}</strong>{" "}
                  <span className="text-secondary">from {s.submittedBy}</span>
                  {s.adminNote && <span className="block text-[13px] text-secondary">{s.adminNote}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Pill tone={s.status}>{s.status}</Pill>
                  {s.placeId && (
                    <Link href={`/admin/places/${s.placeId}`} className="font-semibold text-ink underline">
                      Place
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    );
  }

  const [pending, places] = await Promise.all([pendingSubmissions(), placeChoices()]);
  const extras = await Promise.all(
    pending.map(async (s) => ({ photoUrl: await signedPhotoUrl(s.photoPath), nearby: await sitesNear(s.lat, s.lng) })),
  );
  if (pending.length === 0) {
    return (
      <AdminCard>
        <p className="text-[14px] text-body">No suggestions waiting. 🎉</p>
      </AdminCard>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-secondary">
        {pending.length} waiting, oldest first. Check each one is a business or public place, not a home, and doesn&apos;t
        name a private person.
      </p>
      {pending.map((s, i) => (
        <SubmissionCard key={s.id} s={s} photoUrl={extras[i].photoUrl} nearby={extras[i].nearby} places={places} />
      ))}
    </div>
  );
}

export default function SubmissionsPage(props: PageProps<"/admin/submissions">) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] font-bold text-ink">Submissions</h1>
        <nav aria-label="Submission lists" className="flex gap-2 text-[14px] font-semibold">
          <Link href="/admin/submissions" className="rounded-full bg-surface px-3 py-1.5 text-ink shadow-card">
            Waiting
          </Link>
          <Link href="/admin/submissions?view=reviewed" className="rounded-full bg-surface px-3 py-1.5 text-ink shadow-card">
            Reviewed
          </Link>
        </nav>
      </div>
      <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
        <Queue searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
