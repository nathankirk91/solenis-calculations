import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  await prisma.calculation.upsert({
    where: { id: "polymer-973-adipic-deta" },
    update: {
      title: "Polymer 973 — Adipic Acid:DETA Ratio",
      description:
        "Calculate Adipic Acid and DETA charges from a batch size or either reactant mass.",
      category: "polymer",
      href: "/calculations/polymer-973-adipic-deta",
      isAvailable: true,
      sortOrder: 1,
    },
    create: {
      id: "polymer-973-adipic-deta",
      slug: "polymer-973-adipic-deta",
      title: "Polymer 973 — Adipic Acid:DETA Ratio",
      description:
        "Calculate Adipic Acid and DETA charges from a batch size or either reactant mass.",
      category: "polymer",
      href: "/calculations/polymer-973-adipic-deta",
      isAvailable: true,
      sortOrder: 1,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
