import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

export default function App() {
  return (
    <div className="flex h-full bg-[var(--brand-50)] text-[var(--brand-800)]">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
