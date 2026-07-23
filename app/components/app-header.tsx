import { Form, Link } from "react-router";

import { Button } from "~/components/ui/button";
import type { AuthUser } from "~/lib/user.server";

type Props = {
  user?: AuthUser | null;
};

export function AppHeader({ user }: Props) {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/" className="group flex flex-col">
          <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Solenis
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            Calculations
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">All calculators</Link>
          </Button>

          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
              <Form method="post" action="/logout">
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </Form>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
