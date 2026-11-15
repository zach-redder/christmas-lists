import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GiverListView } from "@/components/GiverListView";
import { getDb } from "@/server/db";
import { getListForGiver, OwnListError } from "@/server/giver";
import { requireUser } from "@/server/session";

export const metadata = { title: "Family List · Redder Christmas 2026" };

export default async function PersonListPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const me = await requireUser();
  // Secrecy rule: nobody may view their own list from the gift-giver side.
  // getListForGiver checks against the canonical database id, so any spelling of my id is caught.
  const list = await getListForGiver(await getDb(), me.id, userId).catch((err: unknown) => {
    if (err instanceof OwnListError) redirect("/my-list");
    throw err;
  });
  if (!list) notFound();

  return (
    <div className="space-y-5">
      <Link href="/family" className="inline-flex min-h-11 items-center font-semibold text-pine hover:underline">
        <span aria-hidden="true">←&nbsp;</span>All family lists
      </Link>
      <div>
        <h1 className="font-script text-5xl font-bold text-cranberry">{list.owner.name}&apos;s List</h1>
        <p className="mt-1 text-ink-soft">
          Number 1 is what {list.owner.name} wants most. {list.owner.name} can&apos;t see anything you mark here.
        </p>
      </div>
      <GiverListView list={list} />
    </div>
  );
}
