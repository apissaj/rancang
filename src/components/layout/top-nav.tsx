"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AuthButton } from "@/components/layout/auth-button";

const links = [
  { href: "/chat", label: "Chat" },
  { href: "/plan", label: "Rencana" },
  { href: "/design", label: "Desain" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight transition-opacity hover:opacity-80">
          <Hammer className="h-5 w-5" />
          Rancang
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                pathname.startsWith(link.href) && "bg-accent text-accent-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
