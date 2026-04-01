import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  BookOpen,
  PenTool,
  Users,
  Building2,
  Layers,
  FolderTree,
  Box,
  Diamond,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ROUTES } from "@/lib/constants";
import { invitationsApi } from "@/api/invitations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const adminNav: NavItem[] = [
  { label: "Пользователи", href: ROUTES.ADMIN_USERS, icon: <Users className="h-4 w-4" /> },
  { label: "Компании", href: ROUTES.ADMIN_COMPANIES, icon: <Building2 className="h-4 w-4" /> },
  { label: "Каталоги", href: ROUTES.ADMIN_CATALOGS, icon: <Layers className="h-4 w-4" /> },
  { label: "Категории", href: ROUTES.ADMIN_CATEGORIES, icon: <FolderTree className="h-4 w-4" /> },
  { label: "Шкафы", href: ROUTES.ADMIN_CABINETS, icon: <Box className="h-4 w-4" /> },
];

function NavLink({ item }: { item: NavItem }) {
  const location = useLocation();
  const isActive = location.pathname === item.href;

  return (
    <Link
      to={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <span className={cn(
        "transition-colors duration-200",
        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
      )}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <Badge variant="default" className="ml-auto h-5 min-w-[20px] justify-center rounded-full px-1.5 text-[10px]">
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}

export function Sidebar() {
  const { isAdmin, isManager, companies, currentCompanyId, switchCompany } = useAuth();

  const { data: invitations } = useQuery({
    queryKey: ["my-invitations"],
    queryFn: invitationsApi.listMyInvitations,
    staleTime: 5 * 60 * 1000,
  });
  const pendingCount = invitations?.length ?? 0;

  const mainNav: NavItem[] = [
    { label: "Главная", href: ROUTES.DASHBOARD, icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Каталоги", href: ROUTES.CATALOGS, icon: <BookOpen className="h-4 w-4" /> },
    { label: "Рабочие пространства", href: ROUTES.WORKSPACES, icon: <PenTool className="h-4 w-4" /> },
    ...(isManager
      ? [{ label: "Команда", href: ROUTES.TEAM, icon: <Users className="h-4 w-4" /> }]
      : []),
    { label: "Приглашения", href: ROUTES.INVITATIONS, icon: <Mail className="h-4 w-4" />, badge: pendingCount },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col bg-sidebar-background">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6">
        <Link to={ROUTES.DASHBOARD} className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/20">
            <Diamond className="h-4 w-4 text-sidebar-primary" />
          </div>
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-sidebar-foreground">
              Norvik
            </span>
            <span className="ml-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/40">
              Studio
            </span>
          </div>
        </Link>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-sidebar-border" />

      {/* Company Switcher */}
      {companies.length > 0 && (
        <div className="px-4 py-3">
          {companies.length > 1 ? (
            <Select
              value={String(currentCompanyId)}
              onValueChange={(v) => switchCompany(Number(v))}
            >
              <SelectTrigger className="w-full rounded-lg border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground text-sm">
                <Building2 className="mr-2 h-4 w-4 shrink-0 text-sidebar-foreground/50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.company_id} value={String(c.company_id)}>
                    <span className="flex items-center gap-2">
                      {c.company_name}
                      {c.is_manager && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Менеджер
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/30 px-3 py-2 text-sm text-sidebar-foreground/80">
              <Building2 className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
              <span className="truncate">{companies[0].company_name}</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/30">
          Навигация
        </div>
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {isAdmin && (
          <>
            <div className="mb-3 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/30">
              Администрирование
            </div>
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="mx-4 h-px bg-sidebar-border" />
      <div className="px-6 py-4">
        <p className="text-[10px] tracking-wider text-sidebar-foreground/25">
          NORVIK STUDIO v0.1.0
        </p>
      </div>
    </aside>
  );
}
