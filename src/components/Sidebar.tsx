import { NavLink } from "react-router-dom";
import {
  MonitorCheck,
  KeyRound,
  Store,
  Workflow,
  FolderKanban,
  Settings as SettingsIcon,
} from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n";

const items = [
  { to: "/", labelKey: "nav.environment", icon: MonitorCheck, end: true },
  { to: "/providers", labelKey: "nav.providers", icon: KeyRound, end: false },
  { to: "/market", labelKey: "nav.market", icon: Store, end: false },
  { to: "/roles", labelKey: "nav.roles", icon: Workflow, end: false },
  { to: "/workspaces", labelKey: "nav.workspaces", icon: FolderKanban, end: false },
  { to: "/settings", labelKey: "nav.settings", icon: SettingsIcon, end: false },
];

export default function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-5">
        <div className="text-base font-semibold text-slate-900">{t("app.name")}</div>
        <div className="text-xs text-slate-400">{t("app.tagline")}</div>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {items.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )
            }
          >
            <Icon size={18} />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-3 text-xs text-slate-400">v1.0.0 · MVP</div>
    </aside>
  );
}
