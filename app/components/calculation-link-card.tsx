import { Link } from "react-router";

import { CatalogLinkCard } from "~/components/catalog-link-card";
import type { CalculationCard } from "~/lib/calculations";

type Props = {
  calculation: CalculationCard;
};

/** @deprecated Prefer CatalogLinkCard — kept for existing imports. */
export function CalculationLinkCard({ calculation }: Props) {
  return <CatalogLinkCard item={calculation} />;
}
