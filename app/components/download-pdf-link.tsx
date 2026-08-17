import { DownloadIcon } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/components/ui/button";

export function DownloadPdfLink({
  href,
  label = "View PDF",
}: {
  href: string;
  label?: string;
}) {
  const viewHref = `${href}/view`;
  return (
    <Button asChild variant="outline" size="sm">
      <Link to={viewHref}>
        <DownloadIcon data-icon="inline-start" />
        {label}
      </Link>
    </Button>
  );
}
