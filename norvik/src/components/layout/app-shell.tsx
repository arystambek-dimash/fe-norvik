import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export function AppShell() {
  return (
    <div className="bg-grain min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Header />
        <main className="px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
