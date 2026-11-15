import Link from "next/link";
import { GiftIcon, ListIcon, RibbonDivider, TreeIcon } from "@/components/decorations";
import { requireUser } from "@/server/session";

const CHOICES = [
  {
    href: "/my-list",
    title: "My List",
    text: "Write down what you're wishing for, and put your favorites first.",
    Icon: ListIcon,
  },
  {
    href: "/family",
    title: "Family Lists",
    text: "Peek at everyone else's wishes and mark what you're getting them.",
    Icon: TreeIcon,
  },
  {
    href: "/my-gifts",
    title: "My Gifts",
    text: "Your shopping list: everything you've said you'll give.",
    Icon: GiftIcon,
  },
];

export default async function HomePage() {
  const me = await requireUser();
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="font-script text-3xl text-pine">Merry Christmas,</p>
        <h1 className="text-4xl font-bold sm:text-5xl">{me.name}!</h1>
      </div>
      <RibbonDivider />
      <ul className="tilt grid gap-5 sm:grid-cols-3">
        {CHOICES.map(({ href, title, text, Icon }) => (
          <li key={href} className="transition-[rotate]">
            <Link href={href} className="gift-tag block h-full hover:border-fir">
              <Icon className="mb-2 h-8 w-8 text-cranberry" />
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="mt-1 text-ink-soft">{text}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-ink-soft">
        Don&apos;t worry: nobody can see what&apos;s been gotten from <em>their own</em> list. No peeking at Santa&apos;s workshop!
      </p>
    </div>
  );
}
