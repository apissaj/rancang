"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hammer, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AuthButton } from "@/components/layout/auth-button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/chat", label: "Chat" },
  { href: "/plan", label: "Rencana" },
  { href: "/design", label: "Desain" },
];

export function TopNav() {
  const pathname = usePathname();

  const active = (href: string) => pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 pl-0 text-base font-semibold tracking-tight transition-opacity hover:opacity-80">
          <Hammer className="h-5 w-5" />
          Rancang
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0 md:flex">
          {links.map((link) => (
                      <Button
                        key={link.href}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "px-2.5 font-medium",
                          active(link.href) && "bg-accent text-accent-foreground"
                        )}
                        render={<Link href={link.href}>{link.label}</Link>}
                      />
                    ))}
        </nav>

        <div className="hidden items-center gap-1 md:flex">
          <ThemeToggle />
          <AuthButton />
        </div>

        {/* Mobile: hamburger + theme */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Buka menu" className="rounded-lg">
                  <Menu className="h-4 w-4" />
                </Button>
              }
            />
            <SheetContent side="right" className="flex flex-col justify-between">
              <div>
                <SheetHeader className="text-left">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <Hammer className="h-4 w-4" />
                    Rancang
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                        active(link.href) && "bg-accent text-accent-foreground"
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="border-t border-border pt-4">
                <AuthButton />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}