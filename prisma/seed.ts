import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { POLYMER_ADIPIC_DETA_PRODUCTS } from "../app/lib/polymer-adipic-deta";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  for (const product of POLYMER_ADIPIC_DETA_PRODUCTS) {
    await prisma.calculation.upsert({
      where: { id: product.id },
      update: {
        title: product.title,
        description: product.description,
        category: product.category,
        href: product.href,
        isAvailable: true,
        sortOrder: product.sortOrder,
      },
      create: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        description: product.description,
        category: product.category,
        href: product.href,
        isAvailable: true,
        sortOrder: product.sortOrder,
      },
    });
  }

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

  console.log(`Seeded ${POLYMER_ADIPIC_DETA_PRODUCTS.length} calculations`);
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
