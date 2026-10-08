"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp, useScored } from "@/lib/store";
import { cx } from "./ui";

export function Nav() {
  const pathname = usePathname();
  const { agent } = useApp();
  const matches = useScored().filter((l) => !l.excluded.length).length;
  const leads = Object.values(agent.leads);
  const tours = leads.filter((l) => l.tour && (l.stage === "tour_booked" || l.stage === "toured")).length;
  const active = leads.filter((l) => !["dismissed", "ghosted"].includes(l.stage)).length;

  const links = [
    { href: "/", label: "Intake" },
    { href: "/search", label: "Matches", count: matches || undefined },
    { href: "/agent", label: "Agent", count: active || undefined },
    { href: "/tracker", label: "Tracker" },
    { href: "/calendar", label: "Tours", count: tours || undefined },
  ];

  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">P</span>
          Partly
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cx(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
                pathname === l.href ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {l.label}
              {l.count ? (
                <span className={cx("rounded-full px-1.5 text-[11px]", pathname === l.href ? "bg-white/20" : "bg-slate-200 text-slate-700")}>
                  {l.count}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
