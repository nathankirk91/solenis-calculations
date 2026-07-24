import { Form, Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { canManageOperators, canReviewRuns } from "~/lib/roles";
import type { AuthUser } from "~/lib/user.server";

type Props = {
  user?: AuthUser | null;
  pendingCount?: number;
};

export function AppHeader({ user, pendingCount = 0 }: Props) {
  const showApprovals = user ? canReviewRuns(user.role) : false;
  const showOperators = user ? canManageOperators(user.role) : false;

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
            <Button asChild variant="ghost" size="sm">
              <Link to="/history">History</Link>
            </Button>
          ) : null}

          {showApprovals ? (
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/approvals">
                Approvals
                {pendingCount > 0 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {pendingCount}
                  </Badge>
                ) : null}
              </Link>
            </Button>
          ) : null}

          {showOperators ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/operators">Operators</Link>
            </Button>
          ) : null}

          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.name ?? user.email}
                <span className="ml-1 text-xs uppercase tracking-wide opacity-70">
                  ({user.role.toLowerCase()})
                </span>
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
