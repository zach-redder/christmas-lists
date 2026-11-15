import { JoinForm, NameButton } from "@/components/GateForms";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { hasFamilyAccess } from "@/server/session";
import { listUsers } from "@/server/users";

export const metadata = { title: "Who are you? · Redder Christmas 2026" };

export default async function SignInPage() {
  // The family name list is only for people who know the passcode.
  if (!(await hasFamilyAccess())) redirect("/welcome");
  const people = await listUsers(await getDb());

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
    </div>
  );
}
