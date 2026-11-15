import Link from "next/link";
import { RibbonDivider } from "@/components/decorations";
import { getDb } from "@/server/db";
import { listFamily } from "@/server/giver";
import { requireUser } from "@/server/session";

export const metadata = { title: "Family Lists · Redder Christmas 2026" };

export default async function FamilyPage() {
  const me = await requireUser();
  const family = await listFamily(await getDb(), me.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl font-bold">Family Lists</h1>
        <p className="mt-2 text-ink-soft">Tap a name to see their wishes and mark what you&apos;re getting them.</p>
      </div>
      <RibbonDivider />
      {family.length === 0 ? (
        <p className="py-6 text-center font-script text-2xl text-ink-soft">
          No one else has joined yet. Send the family the link!
        </p>
      ) : (
        <ul className="tilt grid grid-cols-2 gap-4 sm:grid-cols-3">
          {family.map((person) => (
            <li key={person.id} className="transition-[rotate]">
              <Link href={`/family/${person.id}`} className="gift-tag block h-full pt-7 pl-9 hover:border-fir">
                <span className="block font-script text-[1.7rem] leading-tight font-bold [overflow-wrap:anywhere] [word-break:normal] text-cranberry sm:text-3xl">
                  {person.name}
                </span>
                <span className="mt-2 block text-sm text-ink-soft">
                  {person.itemCount === 0
                    ? "No wishes yet"
                    : `${person.itemCount} ${person.itemCount === 1 ? "wish" : "wishes"}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
