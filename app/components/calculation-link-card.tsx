import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { CalculationCard } from "~/lib/calculations";
import { cn } from "~/lib/utils";

type Props = {
  calculation: CalculationCard;
};

export function CalculationLinkCard({ calculation }: Props) {
  const content = (
    <Card
      className={cn(
        "h-full border-border/80 transition-[transform,box-shadow,background-color,border-color] duration-200",
        calculation.isAvailable
          ? "hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
          : "opacity-60",
      )}
    >
      <CardHeader>
        <div className="mb-2 flex items-center gap-2">
          <Badge
            variant="secondary"
            className="bg-brand/15 text-brand-navy"
          >
            {calculation.category}
          </Badge>
          {!calculation.isAvailable ? (
            <Badge variant="outline">Coming soon</Badge>
          ) : null}
        </div>
        <CardTitle className="text-lg text-brand-navy">
          {calculation.title}
        </CardTitle>
        <CardDescription>{calculation.description}</CardDescription>
      </CardHeader>
    </Card>
  );

  if (!calculation.isAvailable) {
    return (
      <div aria-disabled className="cursor-not-allowed">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={calculation.href}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  );
}
