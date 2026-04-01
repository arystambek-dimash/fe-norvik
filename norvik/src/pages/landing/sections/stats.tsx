import { useEffect, useRef, useState } from "react";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

const formatNumber = (n: number) => Math.round(n).toLocaleString("en-US");

function useCountUp(target: number, duration: number, isActive: boolean) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive) {
      setValue(0);
      return;
    }

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, isActive]);

  return formatNumber(value);
}

const stats = [
  { numericValue: 10000, suffix: "+", label: "Проектов создано" },
  { numericValue: 500, suffix: "+", label: "Активных пользователей" },
  { numericValue: 50, suffix: "+", label: "Коллекций" },
  { numericValue: 99, suffix: "%", label: "Удовлетворённость" },
];

function StatCard({
  stat,
  index,
}: {
  stat: (typeof stats)[number];
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal();
  const displayValue = useCountUp(stat.numericValue, 2000, isVisible);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${index * 120}ms` }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] p-8 backdrop-blur-md transition-all duration-700",
        "before:absolute before:top-0 before:left-4 before:right-4 before:h-[2px] before:rounded-full before:bg-gradient-to-r before:from-transparent before:via-brass/40 before:to-transparent",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
    >
      <p className="font-display text-4xl text-white md:text-5xl text-center">
        {displayValue}
        {stat.suffix}
      </p>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs uppercase tracking-[0.2em] text-white/40">
        <span className="inline-block h-1 w-1 rounded-full bg-brass/60" />
        {stat.label}
      </p>
    </div>
  );
}

export function Stats() {
  return (
    <section className="relative bg-espresso py-20 md:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(180,140,60,0.05),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 md:grid-cols-4 md:gap-6">
        {stats.map((stat, index) => (
          <StatCard key={stat.label} stat={stat} index={index} />
        ))}
      </div>
    </section>
  );
}
