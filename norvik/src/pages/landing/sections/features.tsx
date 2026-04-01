import { Box, BookOpen, Users, Share2 } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Box,
    title: "3D-конфигуратор шкафов",
    description:
      "Проектируйте индивидуальные планировки шкафов с 3D-предпросмотром в реальном времени. Точно задавайте размеры, материалы и отделку.",
    colSpan: "md:col-span-2",
  },
  {
    icon: BookOpen,
    title: "Премиальный каталог",
    description:
      "Изучайте подобранные коллекции шкафов премиум-класса, материалов и фурнитуры от ведущих производителей.",
    colSpan: "md:col-span-1",
  },
  {
    icon: Users,
    title: "Совместная работа в реальном времени",
    description:
      "Работайте вместе с командой и клиентами в общих рабочих пространствах. Обсуждайте, комментируйте и дорабатывайте в реальном времени.",
    colSpan: "md:col-span-1",
  },
  {
    icon: Share2,
    title: "Экспорт и обмен",
    description:
      "Формируйте профессиональные коммерческие предложения, экспортируйте детальные спецификации и делитесь интерактивными превью с заказчиками.",
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
            Возможности
          </p>
          <h2 className="font-display text-3xl tracking-tight md:text-4xl">
            Всё, что нужно для создания потрясающих кухонь
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
