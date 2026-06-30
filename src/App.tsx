import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

export default function App() {
  return (
    <div className="flex h-full text-slate-800">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
