import { Link } from "react-router";

import { Button } from "~/components/ui/button";

export function AppHeader() {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="group flex flex-col">
          <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Solenis
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            Calculations
          </span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">All calculators</Link>
        </Button>
      </div>
    </header>
  );
}
