import Link from "next/link";
import { HollySprig, SnowCap } from "@/components/decorations";
import { TabBar, TopNav } from "@/components/TabBar";
import { switchPersonAction } from "@/server/actions";
import { requireUser } from "@/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();

  return (
    <>
      <header className="relative bg-gradient-to-b from-cranberry to-berry-deep text-snow">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
          <Link href="/" className="flex min-h-11 items-center gap-2">
            <HollySprig className="h-8 w-12 drop-shadow" />
            <span className="font-display text-xl font-bold tracking-tight text-snow sm:text-2xl">
              Redder Christmas <span className="font-script text-2xl font-bold text-[#f6d48b] sm:text-3xl">2026</span>
            </span>
          </Link>
          <TopNav />
          <div className="flex items-center gap-2 text-sm">
            <span>
              Hi, <strong className="font-script text-xl">{me.name}</strong>
            </span>
            <form action={switchPersonAction}>
              <button type="submit" className="min-h-11 rounded-full px-2 underline underline-offset-4 hover:text-[#f6d48b]">
                Not you? Switch
              </button>
            </form>
          </div>
        </div>
        <SnowCap className="pointer-events-none absolute top-full left-0 -mt-px h-4 w-full drop-shadow-[0_2px_1px_rgb(43_29_22/0.12)] sm:h-6" />
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-9 pb-32 md:pb-16">{children}</main>
      <TabBar />
    </>
  );
}
