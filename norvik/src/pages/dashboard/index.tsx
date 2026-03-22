import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { ROUTES } from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BookOpen,
  PenTool,
  Users,
  Building2,
  Package,
  Layers,
  ArrowRight,
} from "lucide-react";

interface NavCard {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();

  const mainCards: NavCard[] = [
    {
      title: "Product Catalogs",
      description: "Browse and explore cabinet collections and product lines",
      href: ROUTES.CATALOGS,
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      title: "Design Workspaces",
      description: "Create and manage kitchen layout configurations",
      href: ROUTES.WORKSPACES,
      icon: <PenTool className="h-5 w-5" />,
    },
  ];

  const adminCards: NavCard[] = [
    { title: "Users", description: "Manage team members and access", href: ROUTES.ADMIN_USERS, icon: <Users className="h-5 w-5" /> },
    { title: "Companies", description: "Manage partner organizations", href: ROUTES.ADMIN_COMPANIES, icon: <Building2 className="h-5 w-5" /> },
    { title: "Cabinets", description: "Manage product inventory", href: ROUTES.ADMIN_CABINETS, icon: <Package className="h-5 w-5" /> },
    { title: "Catalogs", description: "Organize product collections", href: ROUTES.ADMIN_CATALOGS, icon: <Layers className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-12">
      {/* Welcome section */}
      <div className="animate-fade-up">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60">Dashboard</p>
        <h1 className="mt-2 text-4xl tracking-tight">
          Welcome back, {user?.first_name}
        </h1>
        <p className="mt-3 max-w-lg text-base text-muted-foreground">
          Your workspace for designing and configuring premium kitchen solutions.
        </p>
      </div>

      {/* Main cards */}
      <div className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">Quick Access</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {mainCards.map((card, i) => (
            <Link key={card.href} to={card.href}>
              <Card className="group animate-fade-up cursor-pointer border-border/60 transition-all duration-300 hover:border-primary/30 hover:shadow-md" style={{ animationDelay: `${(i + 1) * 100}ms` }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary/15">
                      {card.icon}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <CardTitle className="mt-1 text-lg">{card.title}</CardTitle>
                  <CardDescription className="text-sm">{card.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Admin cards */}
      {isAdmin && (
        <div className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">Administration</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {adminCards.map((card, i) => (
              <Link key={card.href} to={card.href}>
                <Card className="group animate-fade-up cursor-pointer border-border/60 transition-all duration-300 hover:border-primary/30 hover:shadow-md" style={{ animationDelay: `${(i + 3) * 100}ms` }}>
                  <CardHeader>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/8 text-primary transition-colors group-hover:bg-primary/15">
                      {card.icon}
                    </div>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                    <CardDescription className="text-xs">{card.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
