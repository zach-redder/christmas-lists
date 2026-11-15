import { JoinForm, NameButton, PinForm } from "@/components/GateForms";
import { redirect } from "next/navigation";
import { leaveFamilyAction } from "@/server/actions";
import { getSignInTarget } from "@/server/auth";
import { getDb } from "@/server/db";
import { currentFamily } from "@/server/session";
import { listUsers } from "@/server/users";

export const metadata = { title: "Who are you?" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ as?: string | string[] }> }) {
  // The family name list is only for people who know the passcode.
  const family = await currentFamily();
  if (!family) redirect("/welcome");
  const db = await getDb();

  const { as } = await searchParams;
  if (typeof as === "string") {
    const target = await getSignInTarget(db, family.id, as);
    if (!target) redirect("/sign-in");
    return <PinForm key={target.user.id} userId={target.user.id} name={target.user.name} setup={!target.hasPin} />;
  }

  const people = await listUsers(db, family.id);

  return (
    <div className="space-y-6">
      {people.length > 0 && (
        <section aria-labelledby="pick-name">
          <h2 id="pick-name" className="mb-3 text-center text-2xl font-bold">
            Who are you?
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            {people.map((p) => (
              <li key={p.id}>
                <NameButton id={p.id} name={p.name} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="new-here" className={people.length ? "border-t border-dashed border-parchment pt-5" : ""}>
        <h2 id="new-here" className="mb-3 text-center text-2xl font-bold">
          {people.length ? "First time here?" : "Who are you?"}
        </h2>
        <JoinForm />
      </section>
      <form action={leaveFamilyAction} className="text-center">
        <button type="submit" className="min-h-11 text-sm text-ink-soft underline underline-offset-4 hover:text-pine">
          Not the {family.name} family? Enter a different password
        </button>
      </form>
    </div>
  );
}
