import { Palette, PenTool, Download, ChevronDown } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: "01",
    icon: Palette,
    title: "Choose Your Style",
    description:
      "Browse our curated catalog of premium cabinet styles, finishes, and hardware options.",
  },
  {
    number: "02",
    icon: PenTool,
    title: "Configure Layout",
    description:
      "Use the visual configurator to arrange cabinets, set dimensions, and perfect your design.",
  },
  {
    number: "03",
    icon: Download,
    title: "Export & Order",
    description:
      "Generate detailed specs, share with clients, and place orders directly from your designs.",
  },
];

function Step({
  step,
  index,
}: {
  step: (typeof steps)[number];
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal();
  const Icon = step.icon;

  return (
    <div
      ref={ref}
      className={cn(
        "group relative transition-all duration-500",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
      style={{ transitionDelay: `${index * 200}ms` }}
    >
      <div className="rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-sm">
        {/* Number badge */}
        <span className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full border border-brass/20 bg-brass/10 text-xs font-semibold text-brass">
          {step.number}
        </span>

        {/* Icon circle with gradient ring */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-brass/30 bg-gradient-to-br from-brass/10 to-transparent shadow-[0_4px_20px_rgba(180,140,60,0.1)] transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-7 w-7 text-brass" />
        </div>

        <h3 className="mb-2 text-center text-lg font-semibold tracking-tight">
          {step.title}
        </h3>
        <p className="mx-auto max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const { ref: lineRef, isVisible: lineVisible } = useScrollReveal();

  return (
    <section id="how-it-works" className="bg-secondary py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            How it Works
          </p>
          <h2 className="font-display text-3xl tracking-tight md:text-4xl">
            From inspiration to installation
          </h2>
        </div>

        <div ref={lineRef} className="relative grid gap-4 md:grid-cols-3 md:gap-8">
          {/* Animated connecting line — desktop only */}
          <div className="absolute left-1/6 right-1/6 top-[3.5rem] hidden items-center md:flex">
            <div
              className={cn(
                "h-[2px] bg-gradient-to-r from-brass/40 via-brass/20 to-brass/40 transition-all duration-1000",
                lineVisible ? "w-full" : "w-0",
              )}
            />
          </div>

          {steps.map((step, i) => (
            <div key={step.number}>
              <Step step={step} index={i} />
              {/* ChevronDown connector on mobile */}
              {i < steps.length - 1 && (
                <div className="flex justify-center md:hidden">
                  <ChevronDown className="h-5 w-5 text-brass/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
