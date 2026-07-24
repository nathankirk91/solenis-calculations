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

const DEFAULT_OPERATORS = [
  "Operator A",
  "Operator B",
  "Operator C",
  "Operator D",
];

async function upsertUser(args: {
  email: string;
  password: string;
  name: string;
  role: "OPERATOR" | "MANAGER" | "ADMIN";
}) {
  const passwordHash = await bcrypt.hash(args.password, 10);
  await prisma.user.upsert({
    where: { email: args.email },
    update: {
      passwordHash,
      name: args.name,
      role: args.role,
    },
    create: {
      email: args.email,
      passwordHash,
      name: args.name,
      role: args.role,
    },
  });
  console.log(`Seeded ${args.role.toLowerCase()} ${args.email}`);
}

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

  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ??
    process.env.SEED_USER_EMAIL ??
    "admin@solenis.local"
  ).toLowerCase();
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD ??
    process.env.SEED_USER_PASSWORD ??
    "changeme";

  await upsertUser({
    email: adminEmail,
    password: adminPassword,
    name: "Admin",
    role: "ADMIN",
  });

  const operatorEmail = (
    process.env.SEED_OPERATOR_EMAIL ?? "operator@solenis.local"
  ).toLowerCase();
  const operatorPassword =
    process.env.SEED_OPERATOR_PASSWORD ?? "changeme";

  await upsertUser({
    email: operatorEmail,
    password: operatorPassword,
    name: "Plant Operator",
    role: "OPERATOR",
  });

  const managerEmail = process.env.SEED_MANAGER_EMAIL?.toLowerCase();
  const managerPassword = process.env.SEED_MANAGER_PASSWORD ?? "changeme";
  if (managerEmail) {
    await upsertUser({
      email: managerEmail,
      password: managerPassword,
      name: process.env.SEED_MANAGER_NAME ?? "Manager",
      role: "MANAGER",
    });
  }

  for (const [index, name] of DEFAULT_OPERATORS.entries()) {
    const existing = await prisma.operator.findFirst({
      where: { name },
      select: { id: true },
    });

    if (existing) {
      await prisma.operator.update({
        where: { id: existing.id },
        data: { isActive: true, sortOrder: index + 1 },
      });
    } else {
      await prisma.operator.create({
        data: {
          name,
          isActive: true,
          sortOrder: index + 1,
        },
      });
    }
  }

  console.log(`Seeded ${POLYMER_ADIPIC_DETA_PRODUCTS.length} calculations`);
  console.log(`Seeded ${DEFAULT_OPERATORS.length} operators`);
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
