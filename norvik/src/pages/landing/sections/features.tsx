import { Box, BookOpen, Users, Share2 } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Box,
    title: "3D Cabinet Configurator",
    description:
      "Design custom cabinet layouts with real-time 3D preview. Adjust dimensions, materials, and finishes with precision.",
    colSpan: "md:col-span-2",
  },
  {
    icon: BookOpen,
    title: "Premium Catalog",
    description:
      "Browse curated collections of high-end cabinet styles, materials, and hardware from leading manufacturers.",
    colSpan: "md:col-span-1",
  },
  {
    icon: Users,
    title: "Real-Time Collaboration",
    description:
      "Work together with your team and clients in shared workspaces. Review, comment, and iterate in real time.",
    colSpan: "md:col-span-1",
  },
  {
    icon: Share2,
    title: "Export & Share",
    description:
      "Generate professional proposals, export detailed specs, and share interactive previews with stakeholders.",
    colSpan: "md:col-span-2",
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[number];
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal();
  const Icon = feature.icon;
  const isHero = feature.colSpan === "md:col-span-2";

  return (
    <div
      ref={ref}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-transparent bg-card p-8 transition-all duration-500",
        "hover:-translate-y-1 hover:border-brass/20 hover:shadow-[0_8px_30px_rgba(180,140,60,0.08)]",
        "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br before:from-brass/[0.04] before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100",
        feature.colSpan,
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
      style={{
        transitionDelay: `${index * 100}ms`,
        ...(isHero && {
          backgroundImage:
            "radial-gradient(circle, rgba(180,140,60,0.1) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }),
      }}
    >
      <div className="relative z-10">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/[0.08] transition-all duration-300 group-hover:scale-110 group-hover:bg-brass/10">
          <Icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:rotate-6" />
        </div>
        <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
          {feature.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="bg-background py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mx-auto mb-4 h-0.5 w-12 rounded-full bg-brass" />
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Features
          </p>
          <h2 className="font-display text-3xl tracking-tight md:text-4xl">
            Everything you need to design stunning kitchens
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
