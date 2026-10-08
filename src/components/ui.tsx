import type { ReactNode } from "react";
import type { FlagSeverity, LeadStage } from "@/lib/types";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-lime-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-14 w-14 text-xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-base";
  return (
    <div className={cx("grid shrink-0 place-items-center rounded-full font-bold text-white shadow-sm", dims, scoreColor(score))}>
      {score}
    </div>
  );
}

export function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cx("h-full rounded-full", scoreColor(value))} style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 text-right tabular-nums text-slate-600">{value}</span>
    </div>
  );
}

const SEVERITY_STYLES: Record<FlagSeverity, string> = {
  high: "bg-rose-50 text-rose-700 ring-rose-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  low: "bg-slate-50 text-slate-600 ring-slate-200",
};

export function FlagChip({ severity, children }: { severity: FlagSeverity; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", SEVERITY_STYLES[severity])}>{children}</span>;
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600", className)}>
      {children}
    </span>
  );
}

export const STAGE_STYLES: Record<LeadStage, string> = {
  shortlisted: "bg-slate-100 text-slate-700",
  queued: "bg-indigo-50 text-indigo-700",
  awaiting: "bg-sky-50 text-sky-700",
  replied: "bg-violet-50 text-violet-700",
  tour_booked: "bg-emerald-50 text-emerald-700",
  toured: "bg-teal-50 text-teal-700",
  applied: "bg-green-100 text-green-800",
  waitlisted: "bg-amber-50 text-amber-800",
  ghosted: "bg-rose-50 text-rose-700",
  dismissed: "bg-slate-50 text-slate-400",
};

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm disabled:bg-indigo-300",
    secondary: "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:text-slate-300",
    ghost: "text-slate-600 hover:bg-slate-100",
  }[variant];
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed", styles, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl bg-white ring-1 ring-slate-200", className)}>{children}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}
