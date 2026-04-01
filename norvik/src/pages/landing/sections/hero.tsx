import { Link } from "react-router-dom";
import { Ruler, Palette, Layers, Sparkles, Gem, Hexagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

const floatingIcons = [
  { Icon: Ruler, className: "top-[18%] left-[8%] animate-float", size: "h-10 w-10" },
  { Icon: Palette, className: "top-[28%] right-[10%] animate-float [animation-delay:1s]", size: "h-12 w-12" },
  { Icon: Layers, className: "bottom-[30%] left-[12%] animate-float [animation-delay:2s]", size: "h-8 w-8" },
  { Icon: Gem, className: "top-[15%] right-[25%] animate-float [animation-delay:0.5s]", size: "h-6 w-6" },
  { Icon: Hexagon, className: "bottom-[22%] right-[8%] animate-float [animation-delay:3s]", size: "h-9 w-9" },
];

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-espresso">
      {/* Multi-layer gradient mesh background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_30%_20%,rgba(180,140,60,0.12),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_70%_80%,rgba(100,60,20,0.08),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(180,140,60,0.06),transparent_70%)]" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating icons */}
      {floatingIcons.map(({ Icon, className, size }, i) => (
        <div
          key={i}
          className={`absolute hidden opacity-20 md:block ${className}`}
        >
          <Icon className={`${size} text-brass`} />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        {/* Pill badge */}
        <div className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-brass/30 bg-white/5 px-4 py-1.5 text-xs tracking-wide text-brass backdrop-blur-sm animate-pulse-glow">
          <Sparkles className="h-3.5 w-3.5" />
          Кухонный дизайн нового уровня
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up [animation-delay:100ms] font-display text-5xl leading-tight text-white md:text-7xl md:leading-tight">
          Кухни, которые
          <br />
          <span className="bg-gradient-to-r from-brass to-yellow-500 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
            вдохновляют
          </span>
        </h1>

        {/* Subheadline */}
        <p className="animate-fade-up [animation-delay:200ms] mx-auto mt-6 max-w-2xl text-lg text-white/50 md:text-xl">
          Профессиональный конфигуратор кухонь для студий и дизайнеров.
          Создавайте впечатляющие планировки, изучайте премиальные каталоги и воплощайте свои идеи в жизнь.
        </p>

        {/* CTAs */}
        <div className="animate-fade-up [animation-delay:300ms] relative mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <div className="absolute inset-0 rounded-full bg-brass/10 blur-2xl -z-10" />
          <Button
            size="lg"
            className="bg-gradient-to-r from-brass to-yellow-600 text-espresso font-semibold shadow-[0_0_30px_rgba(180,140,60,0.3)] hover:shadow-[0_0_40px_rgba(180,140,60,0.5)]"
            asChild
          >
            <Link to={ROUTES.REGISTER}>Начать проектирование</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            asChild
          >
            <a href="#how-it-works">Как это работает</a>
          </Button>
        </div>

        {/* Browser-window mockup */}
        <div className="animate-fade-up [animation-delay:400ms] mx-auto mt-16 hidden max-w-2xl md:block">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur overflow-hidden">
            {/* Browser top bar */}
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-2.5 w-2.5 rounded-full bg-white/15" />
                ))}
              </div>
              <div className="mx-auto text-[11px] text-white/25 tracking-wide">
                norvik.app — Конфигуратор кухонь
              </div>
              <div className="w-[52px]" />
            </div>
            {/* Content area — gradient placeholder */}
            <div className="relative h-56">
              <div className="absolute inset-0 bg-gradient-to-br from-espresso via-walnut/20 to-espresso" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,140,60,0.08),transparent_70%)]" />
              {/* Grid lines suggesting 3D space */}
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(180,140,60,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(180,140,60,0.4) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              {/* Brass accent elements */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 w-16 rounded border border-brass/15 bg-brass/[0.04]"
                  >
                    <div className="mx-auto mt-10 h-2 w-4 rounded-full border border-brass/30" />
                  </div>
                ))}
              </div>
              {/* Bottom reflection gradient */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/[0.03] to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
