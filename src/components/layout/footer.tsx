import Link from "next/link";
import { Hammer } from "lucide-react";
import Reveal from "@/components/effects/reveal";

const columns = [
  {
    title: "Produk",
    links: [
      { label: "Generator PRD", href: "/plan" },
      { label: "Chat Multi-Model", href: "/chat" },
      { label: "Generator Desain", href: "/design" },
    ],
  },
  {
    title: "Sumber",
    links: [
      { label: "Dokumentasi", href: "/plan" },
      { label: "GitHub", href: "https://github.com" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-border sm:mt-28">
      <Reveal>
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-12">
            {/* Brand */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-2">
                <Hammer className="h-5 w-5 text-foreground" />
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  Rancang
                </span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Ubah ide jadi blueprint siap-agent. PRD, spesifikasi, rencana,
                dan tasks — lewat gateway LLM milikmu.
              </p>
            </div>

            {/* Nav columns */}
            <div className="grid grid-cols-2 gap-8 md:col-span-7">
              {columns.map((col) => (
                <div key={col.title}>
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {col.title}
                  </span>
                  <ul className="mt-4 space-y-3">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        <Link
                          href={l.href}
                          target={l.href.startsWith("http") ? "_blank" : undefined}
                          rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Rancang · Dibuat untuk coding agent.
            </p>
            <p className="text-xs text-muted-foreground">
              Tanpa akun · Tanpa database · Data di browser kamu.
            </p>
          </div>
        </div>
      </Reveal>
    </footer>
  );
}