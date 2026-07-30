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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { formatMelbourneTime } from "~/lib/datetime";
import type { ForkliftDayDashboard } from "~/lib/inspections.server";
import { cn } from "~/lib/utils";

type Props = {
  dashboard: ForkliftDayDashboard;
  /** When set, date changes navigate via GET form to this path. */
  filterAction?: string;
  /** Preserve extra query params when changing date (e.g. sort). */
  hiddenFields?: Record<string, string>;
  /** Link under the heading (e.g. to full records). */
  recordsHref?: string;
  className?: string;
};

export function ForkliftDayDashboardCard({
  dashboard,
  filterAction,
  hiddenFields,
  recordsHref,
  className,
}: Props) {
  const unchecked = dashboard.totalUnits - dashboard.checkedCount;

  return (
    <Card className={cn(className)}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl text-brand-navy">
              Forklift checks
            </CardTitle>
            <CardDescription className="mt-1">
              {dashboard.checkedCount} of {dashboard.totalUnits} units checked
              {unchecked > 0 ? ` · ${unchecked} not yet checked` : null}
              {dashboard.needsAttentionCount > 0
                ? ` · ${dashboard.needsAttentionCount} need attention`
                : null}
              {dashboard.actionsRaisedCount > 0
                ? ` · ${dashboard.actionsRaisedCount} actions raised`
                : null}
            </CardDescription>
          </div>
          {recordsHref ? (
            <Button asChild variant="outline" size="sm">
              <Link to={recordsHref}>All records</Link>
            </Button>
          ) : null}
        </div>

        {filterAction ? (
          <form
            method="get"
            action={filterAction}
            className="flex flex-wrap items-end gap-3"
          >
            {hiddenFields
              ? Object.entries(hiddenFields).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))
              : null}
            <div className="grid gap-1.5">
              <Label htmlFor="forklift-day-date">Date</Label>
              <Input
                id="forklift-day-date"
                name="date"
                type="date"
                defaultValue={dashboard.date}
                className="w-auto"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Show day
            </Button>
          </form>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {dashboard.units.map((unit) => {
            const time = unit.latest
              ? formatMelbourneTime(unit.latest.createdAt)
              : null;
            const shortLabel = unit.label.split(" — ")[0] ?? unit.label;

            return (
              <li key={unit.value}>
                {unit.latest ? (
                  <Link
                    to={`/inspections/submissions/${unit.latest.id}`}
                    className={cn(
                      "block rounded-lg border px-3 py-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      unit.latest.status === "NEEDS_ATTENTION"
                        ? "border-amber-600/40 bg-amber-50/80 hover:bg-amber-50"
                        : "border-emerald-600/30 bg-emerald-50/50 hover:bg-emerald-50/80",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-brand-navy">
                        {shortLabel}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          unit.latest.status === "PASSED" &&
                            "border-emerald-600/40 text-emerald-700",
                          unit.latest.status === "NEEDS_ATTENTION" &&
                            "border-amber-600/40 text-amber-800",
                        )}
                      >
                        {unit.latest.status === "PASSED"
                          ? "Passed"
                          : "Needs attention"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {time ? `Checked ${time}` : "Checked"}
                      {unit.runCount > 1 ? ` · ${unit.runCount} checks` : null}
                      {unit.latest.operatorName
                        ? ` · ${unit.latest.operatorName}`
                        : null}
                    </p>
                    <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                      Attention: {unit.latest.attentionCount}
                      {" · "}
                      Actions: {unit.latest.actionCount}
                    </p>
                  </Link>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-3">
                    <p className="font-medium text-muted-foreground">
                      {shortLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Not checked
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
