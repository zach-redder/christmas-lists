import { AdminLoginForm } from "@/components/GateForms";
import { HollySprig } from "@/components/decorations";
import { SubmitButton } from "@/components/ui";
import { adminLogoutAction, adminResetPinAction } from "@/server/actions";
import { adminListPeople } from "@/server/auth";
import { getDb } from "@/server/db";
import { FAMILIES } from "@/server/families";
import { isAdmin } from "@/server/session";

export const metadata = { title: "Admin" };

/** PIN resets only. Shows names and PIN status, never anything about lists or gifts. */
export default async function AdminPage() {
  const signedIn = await isAdmin();
  const people = signedIn ? await adminListPeople(await getDb()) : [];

  return (
    <main className="flex min-h-dvh justify-center px-4 py-10">
      <div className="invitation h-fit w-full max-w-lg px-7 py-9 sm:px-10">
        <HollySprig className="mx-auto h-12 w-20" />
        <h1 className="mt-2 text-center text-3xl font-bold">PIN resets</h1>
        {!signedIn ? (
          <div className="mt-6">
            <AdminLoginForm />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <p className="text-ink-soft">
              Resetting a PIN signs that person out everywhere. Next time they tap their name, they pick a new PIN.
            </p>
            {FAMILIES.map((family) => {
              const members = people.filter((p) => p.family === family.id);
              return (
                <section key={family.id} aria-labelledby={`fam-${family.id}`}>
                  <h2 id={`fam-${family.id}`} className="mb-2 text-2xl font-bold">
                    {family.name} family
                  </h2>
                  {members.length === 0 ? (
                    <p className="text-ink-soft">Nobody has joined yet.</p>
                  ) : (
                    <ul className="divide-y divide-dashed divide-parchment">
                      {members.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span>
                            <strong className="font-script text-2xl text-cranberry">{p.name}</strong>{" "}
                            <span className="text-sm text-ink-soft">
                              {p.locked ? "· locked (too many wrong tries)" : p.hasPin ? "· has a PIN" : "· no PIN yet"}
                            </span>
                          </span>
                          {(p.hasPin || p.locked) && (
                            <form action={adminResetPinAction}>
                              <input type="hidden" name="userId" value={p.id} />
                              <SubmitButton variant="ghost" pendingText="Resetting…" aria-label={`Reset ${p.name}'s PIN`}>
                                Reset PIN
                              </SubmitButton>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
            <form action={adminLogoutAction} className="text-center">
              <SubmitButton variant="quiet">Sign out of admin</SubmitButton>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
