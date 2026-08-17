import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatMelbourneDateTime } from "~/lib/datetime";
import type { PermitRunListItem } from "~/lib/permits.server";
import { cn } from "~/lib/utils";

type Props = {
  pendingPermits: PermitRunListItem[];
  openPermits: PermitRunListItem[];
  /** Compact card layout for the home page. */
  compact?: boolean;
  className?: string;
};

export function PermitDashboard({
  pendingPermits,
  openPermits,
  compact = false,
  className,
}: Props) {
  const totalActive = pendingPermits.length + openPermits.length;

  if (compact) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-brand-navy">
                Permits
              </CardTitle>
              <CardDescription className="mt-1">
                {totalActive === 0
                  ? "No active permits right now"
                  : [
                      pendingPermits.length > 0
                        ? `${pendingPermits.length} pending authorization`
                        : null,
                      openPermits.length > 0
                        ? `${openPermits.length} open`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/permits/dashboard">Dashboard</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <PermitList
            heading="Pending authorization"
            empty="None waiting for sign-off."
            permits={pendingPermits}
            status="pending"
            limit={5}
          />
          <PermitList
            heading="Open"
            empty="None open for close-out."
            permits={openPermits}
            status="open"
            limit={5}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/permits">Issue a permit</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/permits/history">Records</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("grid gap-10", className)}>
      <section aria-labelledby="pending-permits-heading">
        <div className="mb-4">
          <h2
            id="pending-permits-heading"
            className="font-heading text-2xl font-semibold tracking-tight text-brand-navy"
          >
            Pending authorization
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Waiting for the required authorisation signatures before work can
            start (2 or 3, depending on the permit type).
          </p>
        </div>
        <PermitList
          permits={pendingPermits}
          status="pending"
          empty="No permits waiting for authorization."
        />
      </section>

      <section aria-labelledby="open-permits-heading">
        <div className="mb-4">
          <h2
            id="open-permits-heading"
            className="font-heading text-2xl font-semibold tracking-tight text-brand-navy"
          >
            Open permits
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Authorized permits in progress (max 12 hours from start to end).
            Close out when work is finished; remaining sign-offs can still be
            added when only two were required to open.
          </p>
        </div>
        <PermitList
          permits={openPermits}
          status="open"
          empty="No open permits right now."
        />
      </section>
    </div>
  );
}

function PermitList({
  heading,
  permits,
  status,
  empty,
  limit,
}: {
  heading?: string;
  permits: PermitRunListItem[];
  status: "pending" | "open";
  empty: string;
  limit?: number;
}) {
  const items = limit != null ? permits.slice(0, limit) : permits;
  const remaining =
    limit != null && permits.length > limit ? permits.length - limit : 0;

  return (
    <div className="grid gap-2">
      {heading ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-brand-navy">{heading}</h3>
          {permits.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {permits.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid gap-3">
          {items.map((permit) => (
            <li key={permit.id}>
              <Link
                to={`/permits/runs/${permit.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-white/70 px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand/5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-brand-navy">
                    {permit.permitNumber ? (
                      <span className="mr-2 tabular-nums text-muted-foreground">
                        #{permit.permitNumber}
                      </span>
                    ) : null}
                    {permit.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatMelbourneDateTime(permit.createdAt)}
                    {permit.equipmentRef ? ` · ${permit.equipmentRef}` : ""}
                    {permit.area ? ` · ${permit.area}` : ""}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    status === "pending" && "border-sky-600/40 text-sky-800",
                    status === "open" && "border-amber-600/40 text-amber-800",
                  )}
                >
                  {status === "pending" ? "Pending authorization" : "Open"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}

      {remaining > 0 ? (
        <p className="text-xs text-muted-foreground">
          +{remaining} more on the{" "}
          <Link
            to="/permits/dashboard"
            className="underline-offset-4 hover:underline"
          >
            dashboard
          </Link>
        </p>
      ) : null}
    </div>
  );
}
