import { DownloadIcon } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/components/ui/button";

export function DownloadPdfLink({
  href,
  label = "Download PDF",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to={href} reloadDocument>
        <DownloadIcon data-icon="inline-start" />
        {label}
      </Link>
    </Button>
  );
}
