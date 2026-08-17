import { Link } from "react-router";

import { DownloadPdfLink } from "~/components/download-pdf-link";
import { Badge } from "~/components/ui/badge";
import { formatMelbourneDateTime } from "~/lib/datetime";
import { permitRecordHeading, permitStatusLabel } from "~/lib/permit-display";
import type { PermitRunListItem } from "~/lib/permits.server";
import { cn } from "~/lib/utils";

type PermitRecordCardProps = {
  run: PermitRunListItem;
  statusBadge?: {
    label: string;
    className: string;
  };
};

export function PermitRecordCard({ run, statusBadge }: PermitRecordCardProps) {
  const heading = permitRecordHeading({
    workDescription: run.workDescription,
    equipmentRef: run.equipmentRef,
    permitNumber: run.permitNumber,
  });
  const statusLabel = statusBadge?.label ?? permitStatusLabel(run.status);
  const statusClassName =
    statusBadge?.className ??
    cn(
      run.status === "PENDING_AUTHORIZATION" &&
        "border-sky-600/40 text-sky-800",
      run.status === "OPEN" && "border-amber-600/40 text-amber-800",
      run.status === "CLOSED" && "border-emerald-600/40 text-emerald-700",
    );

  const metaParts = [
    formatMelbourneDateTime(run.createdAt),
    run.equipmentRef &&
    run.workDescription &&
    run.equipmentRef !== heading
      ? run.equipmentRef
      : null,
    run.area,
  ].filter(Boolean);

  return (
    <li className="rounded-lg border border-border/70 bg-white/70 px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand/5">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          to={`/permits/runs/${run.id}`}
          className="min-w-0 flex-1"
        >
          <p className="font-heading text-lg font-semibold leading-snug text-brand-navy">
            {heading}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{run.title}</Badge>
            <Badge variant="outline" className={statusClassName}>
              {statusLabel}
            </Badge>
            {run.permitNumber ? (
              <Badge variant="outline" className="tabular-nums">
                #{run.permitNumber}
              </Badge>
            ) : null}
          </div>
          {metaParts.length > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </Link>
        <DownloadPdfLink href={`/permits/runs/${run.id}/pdf`} />
      </div>
    </li>
  );
}
