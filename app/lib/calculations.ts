import { POLYMER_ADIPIC_DETA_PRODUCTS } from "~/lib/polymer-adipic-deta";

export type CalculationCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  href: string;
  isAvailable: boolean;
};

/** Fallback catalog used when Supabase is not configured yet. */
export const FALLBACK_CALCULATIONS: CalculationCard[] =
  POLYMER_ADIPIC_DETA_PRODUCTS.map((product) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    category: "Polymer",
    href: product.href,
    isAvailable: true,
  }));
