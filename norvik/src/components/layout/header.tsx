import { LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-8 backdrop-blur-md">
      <div className="text-sm font-medium tracking-wide text-muted-foreground/60">
        Kitchen Cabinet Configurator
      </div>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {user?.first_name} {user?.last_name}
            </span>
            <span className="text-[11px] text-muted-foreground">{user?.email}</span>
          </div>
        </div>
        <div className="h-6 w-px bg-border" />
        <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" />
          <span className="ml-1.5">Logout</span>
        </Button>
      </div>
    </header>
  );
}
