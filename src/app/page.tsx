import Link from "next/link";
import { ArrowRight, MessagesSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const tools = [
  {
    href: "/chat",
    icon: MessagesSquare,
    title: "Multi-model Chat",
    description:
      "Talk to any configured model, or turn on comparison mode to run the same prompt across 2-3 models at once and see responses stream side-by-side.",
    cta: "Open chat",
  },
  {
    href: "/plan",
    icon: FileText,
    title: "PRD Generator",
    description:
      "Describe an app or feature idea and get a full PRD — goals, user stories, requirements, and a numbered task breakdown ready for an AI coding agent.",
    cta: "Draft a PRD",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-24 sm:py-32">
      <section className="flex flex-col items-center text-center">
        <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-balance sm:text-7xl lg:text-8xl">
          Two tools, one gateway, zero setup.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-balance text-muted-foreground">
          Chat with several models side-by-side, or turn a rough idea into a structured,
          agent-ready PRD in seconds. Everything runs through your own LLM gateway and stays
          in your browser — no accounts, no database.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/plan" />} className="h-11 rounded-full px-6 text-base">
            Draft a PRD
          </Button>
          <Button
            variant="outline"
            render={<Link href="/chat" />}
            className="h-11 rounded-full px-6 text-base"
          >
            Open chat
          </Button>
        </div>
      </section>

      <div className="mt-24 grid gap-4 sm:mt-32 sm:grid-cols-2">
        {tools.map(({ href, icon: Icon, title, description, cta }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col rounded-xl bg-muted p-8 transition-colors hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]"
          >
            <Icon className="size-6" />
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">{description}</p>
            <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium">
              {cta}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
