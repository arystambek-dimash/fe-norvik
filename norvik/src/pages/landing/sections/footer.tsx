import { Diamond, Github, Twitter, Linkedin, type LucideIcon } from "lucide-react";

const socialLinks: { icon: LucideIcon; label: string }[] = [
  { icon: Github, label: "GitHub" },
  { icon: Twitter, label: "Twitter" },
  { icon: Linkedin, label: "LinkedIn" },
];

const columns = [
  {
    title: "Product",
    links: ["Configurator", "Catalog", "Workspaces", "Pricing"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Blog", "Contact"],
  },
  {
    title: "Support",
    links: ["Help Center", "Documentation", "API", "Status"],
  },
];

export function Footer() {
  return (
    <footer className="bg-espresso py-16">
      <div className="mx-auto max-w-7xl px-6">
        {/* Newsletter signup row */}
        <div className="mb-12 flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 md:flex-row">
          <div>
            <h3 className="font-display text-lg text-white">Stay in the loop</h3>
            <p className="text-sm text-white/40">
              Get product updates and design inspiration delivered to your inbox.
            </p>
          </div>
          <div className="flex w-full overflow-hidden rounded-lg border border-white/10 md:w-auto">
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none md:w-64"
            />
            <button className="whitespace-nowrap bg-brass px-5 py-2.5 text-sm font-semibold text-espresso transition-colors hover:bg-brass/90">
              Subscribe
            </button>
          </div>
        </div>

        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand column */}
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <Diamond className="h-5 w-5 text-brass" />
              <span className="font-display text-lg text-white">Norvik</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/40">
              Professional kitchen design and configuration platform for studios
              and designers.
            </p>
            {/* Social media icons */}
            <div className="mt-5 flex items-center gap-3">
              {socialLinks.map(({ icon: Icon, label }) => (
                <Icon
                  key={label}
                  aria-label={label}
                  className="h-4 w-4 cursor-pointer text-white/30 transition-colors duration-200 hover:text-brass"
                />
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <span className="relative inline-block cursor-default text-sm text-white/35 transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-brass/40 after:transition-all after:duration-200 hover:text-brass hover:after:w-full">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Gradient divider + bottom bar */}
        <div className="mt-14">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="flex items-center justify-between pt-6">
            <p className="text-xs text-white/25">
              &copy; {new Date().getFullYear()} Norvik Studio. All rights
              reserved.
            </p>
            <a
              href="#"
              className="text-xs text-white/25 transition-colors hover:text-brass"
            >
              Back to top
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
