import { NavLink } from "react-router-dom";
import {
  MonitorCheck,
  KeyRound,
  Store,
  Workflow,
  FolderKanban,
  Palette,
  Settings as SettingsIcon,
  Command,
} from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n";

const items = [
  { to: "/", labelKey: "nav.environment", icon: MonitorCheck, end: true },
  { to: "/providers", labelKey: "nav.providers", icon: KeyRound, end: false },
  { to: "/market", labelKey: "nav.market", icon: Store, end: false },
  { to: "/roles", labelKey: "nav.roles", icon: Workflow, end: false },
  { to: "/workspaces", labelKey: "nav.workspaces", icon: FolderKanban, end: false },
  { to: "/themes", labelKey: "nav.themes", icon: Palette, end: false },
  { to: "/settings", labelKey: "nav.settings", icon: SettingsIcon, end: false },
];

export default function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--brand-200)] bg-white">
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-600)] text-white shadow-sm shadow-indigo-500/20">
            <Command size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight text-[var(--brand-900)]">
              {t("app.name")}
            </div>
            <div className="truncate text-[11px] font-medium text-[var(--brand-400)]">
              {t("app.tagline")}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {items.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[var(--accent-50)] text-[var(--accent-700)]"
                  : "text-[var(--brand-500)] hover:bg-[var(--brand-50)] hover:text-[var(--brand-800)]",
              )
            }
          >
            <Icon size={17} className="shrink-0 transition-transform duration-150 group-hover:scale-110" />
            <span className="truncate">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 mb-3 mt-auto rounded-xl bg-[var(--brand-50)] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-400)]">
            Version
          </span>
          <span className="rounded-full bg-[var(--brand-200)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-600)]">
            v1.0.0
          </span>
        </div>
        <div className="mt-0.5 text-[10px] text-[var(--brand-400)]">MVP Preview</div>
      </div>
    </aside>
  );
}
