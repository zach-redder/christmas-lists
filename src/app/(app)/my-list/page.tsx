import { RibbonDivider } from "@/components/decorations";
import { MyListView } from "@/components/MyListView";
import { getDb } from "@/server/db";
import { getMyItems } from "@/server/owner";
import { requireUser } from "@/server/session";

export const metadata = { title: "My List · Redder Christmas 2026" };

export default async function MyListPage() {
  const me = await requireUser();
  // Owner-safe query: returns only the owner's own wishes, with no gift-giver data at all.
  const items = await getMyItems(await getDb(), me.id);

  return (
    <div className="space-y-5">
      <div>
        <p className="font-script text-2xl text-pine">Dear Santa…</p>
        <h1 className="text-4xl font-bold">My Christmas List</h1>
        <p className="mt-2 text-ink-soft">
          Put the gift you want <strong>most</strong> at number 1. Use the arrows to move things up or down.
        </p>
      </div>
      <RibbonDivider />
      <MyListView items={items} />
    </div>
  );
}
