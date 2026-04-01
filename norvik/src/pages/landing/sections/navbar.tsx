import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Diamond, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Возможности", href: "#features" },
    { label: "Как это работает", href: "#how-it-works" },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-espresso/70 shadow-lg backdrop-blur-xl backdrop-saturate-150 border-b border-white/[0.06]"
          : "bg-transparent",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-300",
          scrolled ? "h-16" : "h-20",
        )}
      >
        {/* Logo */}
        <a href="#" className="group flex items-center gap-2.5">
          <Diamond className="h-6 w-6 text-brass transition-transform duration-300 group-hover:rotate-12" />
          <span className="font-display text-lg text-white">Norvik</span>
        </a>

        {/* Center links — desktop */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative text-sm text-white/60 transition-colors hover:text-white after:absolute after:bottom-0 after:left-1/2 after:h-[1.5px] after:w-0 after:bg-brass after:-translate-x-1/2 after:transition-all after:duration-300 hover:after:w-full"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right actions — desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm" className="text-white/70 hover:bg-white/10 hover:text-white" asChild>
            <Link to={ROUTES.LOGIN}>Войти</Link>
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-brass to-yellow-600 text-espresso font-semibold animate-cta-glow"
            asChild
          >
            <Link to={ROUTES.REGISTER}>Начать</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out border-t border-white/10 bg-espresso/95 backdrop-blur-md md:hidden",
          mobileOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0 border-t-transparent",
        )}
      >
        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-white/60 transition-colors hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <Button variant="ghost" className="justify-start text-white/70 hover:bg-white/10 hover:text-white" asChild>
              <Link to={ROUTES.LOGIN}>Войти</Link>
            </Button>
            <Button
              className="bg-gradient-to-r from-brass to-yellow-600 text-espresso font-semibold"
              asChild
            >
              <Link to={ROUTES.REGISTER}>Начать</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
