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
  { href: "/plan", label: "Rencana" },
  { href: "/design", label: "Desain" },
  { href: "/projects", label: "Proyek" },
];

const APP_PATHS = ["/plan", "/design", "/projects"];

// Desktop navigation links (shared between variants)
function DesktopLinks({ active }: { active: (href: string) => boolean }) {
  return (
    <nav className="flex items-center gap-0">
      {links.map((link) => (
        <Button
          key={link.href}
          variant="ghost"
          size="sm"
          className={cn(
            "px-2.5 text-sm font-medium",
            active(link.href) && "bg-muted text-foreground"
          )}
          nativeButton={false} render={<Link href={link.href}>{link.label}</Link>}
        />
      ))}
    </nav>
  );
}

// Brand block (shared)
function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-lg font-semibold tracking-tight transition-opacity hover:opacity-80"
    >
      <Hammer className="h-5 w-5" />
      Rancang
    </Link>
  );
}

// Desktop trailing actions (theme + auth)
function DesktopActions({ theme = true }: { theme?: boolean }) {
  return (
    <div className="hidden items-center gap-1 md:flex">
      {theme && <ThemeToggle />}
      <AuthButton />
    </div>
  );
}

// Mobile menu (shared)
function MobileMenu({ active, theme = true }: { active: (href: string) => boolean; theme?: boolean }) {
  return (
    <div className="flex items-center gap-1 md:hidden">
      {theme && <ThemeToggle />}
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
                    "rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted hover:text-foreground",
                    active(link.href) && "bg-muted text-foreground"
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
  );
}

export function TopNav() {
  const pathname = usePathname();
  const isApp = APP_PATHS.some((p) => pathname.startsWith(p));

  const active = (href: string) => pathname.startsWith(href);

  if (isApp) {
    // App pages: brand + nav on the left, auth actions on the right (no theme toggle)
    return (
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
        <div className="flex h-14 items-stretch justify-between">
          <div className="flex items-stretch">
            <div className="flex w-72 shrink-0 items-center border-r border-border px-4">
              <Brand />
            </div>
            <div className="hidden items-center pl-6 md:flex">
              <DesktopLinks active={active} />
            </div>
          </div>
          <div className="flex items-center gap-1 pr-4">
            <DesktopActions theme={false} />
            <MobileMenu active={active} theme={false} />
          </div>
        </div>
      </header>
    );
  }

  // Landing: brand left, nav centered, actions right (within max-w-6xl)
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Brand />
        <div className="hidden md:flex">
          <DesktopLinks active={active} />
        </div>
        <div className="flex items-center gap-1">
          <DesktopActions />
          <MobileMenu active={active} />
        </div>
      </div>
    </header>
  );
}