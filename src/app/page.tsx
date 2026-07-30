import Link from "next/link";
import { ArrowRight, MessagesSquare, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-6xl flex-1 flex-col items-center px-4 py-16 text-center">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        Two tools, one gateway, zero setup.
      </h1>
      <p className="mt-4 max-w-xl text-balance text-muted-foreground">
        Chat with several models side-by-side, or turn a rough idea into a structured,
        agent-ready PRD in seconds. Everything runs through your own LLM gateway and stays
        in your browser — no accounts, no database.
      </p>

      <div className="mt-12 grid w-full gap-6 sm:grid-cols-2">
        <Link href="/chat" className="group text-left">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardHeader>
              <MessagesSquare className="h-8 w-8" />
              <CardTitle className="mt-2 text-2xl">Multi-model Chat</CardTitle>
              <CardDescription>
                Talk to any configured model, or turn on comparison mode to run the same prompt
                across 2-3 models at once and see responses stream side-by-side.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open chat <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/plan" className="group text-left">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardHeader>
              <FileText className="h-8 w-8" />
              <CardTitle className="mt-2 text-2xl">PRD Generator</CardTitle>
              <CardDescription>
                Describe an app or feature idea and get a full PRD — goals, user stories,
                requirements, and a numbered task breakdown ready for an AI coding agent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Draft a PRD <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
