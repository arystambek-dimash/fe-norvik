import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

const AVATARS = ["AK", "MR", "SL", "JD"];

export function Cta() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="bg-background py-24 md:py-32">
      <div
        ref={ref}
        className={cn(
          "mx-auto max-w-5xl px-6 transition-all duration-700",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        )}
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-espresso via-espresso/95 to-walnut p-12 text-center md:p-20">
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Floating decorative orbs */}
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-brass/10 blur-3xl animate-float" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-brass/[0.07] blur-2xl animate-float [animation-delay:2s]" />
          <div className="absolute top-1/2 right-1/4 h-24 w-24 rounded-full bg-yellow-600/[0.05] blur-2xl animate-float [animation-delay:1s]" />
          <div className="absolute bottom-1/4 left-1/6 h-20 w-20 rounded-full bg-brass/[0.06] blur-2xl animate-float [animation-delay:3s]" />

          {/* Content */}
          <div className="relative z-10">
            {/* Decorative gradient line */}
            <div className="mx-auto mb-10 h-px w-24 bg-gradient-to-r from-transparent via-brass/50 to-transparent" />

            <h2 className="font-display text-3xl tracking-tight text-white md:text-5xl">
              Ready to transform your
              <br />
              <span className="bg-gradient-to-r from-brass to-yellow-500 bg-clip-text text-transparent">
                kitchen design?
              </span>
            </h2>

            <p className="mx-auto mt-5 max-w-lg text-white/60">
              Join hundreds of designers and studios already using Norvik to
              create exceptional kitchen spaces.
            </p>

            {/* Dual CTA buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="bg-gradient-to-r from-brass to-yellow-600 text-espresso font-semibold shadow-[0_0_30px_rgba(180,140,60,0.25)] hover:shadow-[0_0_40px_rgba(180,140,60,0.45)]"
                asChild
              >
                <Link to={ROUTES.REGISTER}>Get Started — It's Free</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                asChild
              >
                <Link to={ROUTES.REGISTER}>Learn More</Link>
              </Button>
            </div>

            {/* Social proof */}
            <div className="mt-8 flex items-center justify-center gap-3">
              <div className="flex items-center">
                {AVATARS.map((initials, i) => (
                  <div
                    key={initials}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 border-espresso bg-brass/20 text-xs font-medium text-white/70",
                      i > 0 && "-ml-2",
                    )}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <span className="text-sm text-white/40">
                Join 500+ designers
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
