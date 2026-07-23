import "dotenv/config";
import bcrypt from "bcryptjs";
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
        "After charging ~90% DETA and all Adipic Acid, calculate the extra DETA required.",
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
        "After charging ~90% DETA and all Adipic Acid, calculate the extra DETA required.",
      category: "polymer",
      href: "/calculations/polymer-973-adipic-deta",
      isAvailable: true,
      sortOrder: 1,
    },
  });

  const email = (process.env.SEED_USER_EMAIL ?? "admin@solenis.local").toLowerCase();
  const password = process.env.SEED_USER_PASSWORD ?? "changeme";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      name: "Admin",
    },
    create: {
      email,
      passwordHash,
      name: "Admin",
    },
  });

  console.log(`Seeded user ${email}`);
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
