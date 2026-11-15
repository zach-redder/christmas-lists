"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GiftIcon, ListIcon, TreeIcon } from "./decorations";

const TABS = [
  { href: "/my-list", label: "My List", Icon: ListIcon },
  { href: "/family", label: "Family Lists", Icon: TreeIcon },
  { href: "/my-gifts", label: "My Gifts", Icon: GiftIcon },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom bar on phones. */
export function TabBar() {
  const isActive = useActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-cranberry bg-snow/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-10px_rgb(43_29_22/0.35)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${
                  active ? "text-cranberry" : "text-ink-soft"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className={active ? "border-b-2 border-cranberry" : "border-b-2 border-transparent"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Inline nav in the header on larger screens. */
export function TopNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex gap-1">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold transition-colors ${
                  active ? "bg-snow text-cranberry" : "text-snow hover:bg-white/15"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
