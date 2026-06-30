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

const items = [
  { to: "/", label: "环境", icon: MonitorCheck, end: true },
  { to: "/providers", label: "API 供应商", icon: KeyRound, end: false },
  { to: "/market", label: "市场", icon: Store, end: false },
  { to: "/roles", label: "角色工作流", icon: Workflow, end: false },
  { to: "/workspaces", label: "工作区", icon: FolderKanban, end: false },
  { to: "/settings", label: "设置", icon: SettingsIcon, end: false },
];

export default function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-5">
        <div className="text-base font-semibold text-slate-900">AI 开发控制台</div>
        <div className="text-xs text-slate-400">Claude / Codex 一体化</div>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {items.map(({ to, label, icon: Icon, end }) => (
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
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-3 text-xs text-slate-400">v0.1.0 · MVP</div>
    </aside>
  );
}
