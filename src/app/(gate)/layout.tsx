import { HollySprig } from "@/components/decorations";
import { currentFamily } from "@/server/session";

export default async function GateLayout({ children }: { children: React.ReactNode }) {
  // Before the password is entered we don't know (or reveal) which families use the site.
  const family = await currentFamily();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="invitation w-full max-w-md px-7 py-9 text-center sm:px-10">
        <HollySprig className="mx-auto h-12 w-20" />
        <p className="mt-2 font-script text-2xl text-pine">You&apos;re invited to</p>
        <h1 className="text-4xl font-bold">
          {family?.name ?? "Family"} Christmas <span className="font-script text-cranberry">2026</span>
        </h1>
        <div className="mt-6 text-left">{children}</div>
      </div>
    </main>
  );
}
