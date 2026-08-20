import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, Prisma } from "../generated/prisma/client";
import {
  INSPECTION_DEFINITIONS,
  questionTypeStoresOptions,
} from "../app/lib/inspections";
import { POLYMER_ADIPIC_DETA_PRODUCTS } from "../app/lib/polymer-adipic-deta";
import {
  ensureRolesAndSignOffDefaults,
  HSOLENIS_OPERATOR_ROLE_SLUG,
} from "../app/lib/roles.server";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function upsertUser(args: {
  email: string;
  password: string;
  name: string;
  role: "OPERATOR" | "MANAGER" | "ADMIN";
}) {
  const passwordHash = await bcrypt.hash(args.password, 10);
  const existing = await prisma.user.findUnique({
    where: { email: args.email },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { email: args.email },
      data: {
        name: args.name,
        role: args.role,
      },
    });
    console.log(`Updated ${args.role.toLowerCase()} ${args.email} (password unchanged)`);
    return;
  }

  await prisma.user.create({
    data: {
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

  const orderedInspections = [...INSPECTION_DEFINITIONS].sort((a, b) => {
    const aChild = a.templateInspectionId ? 1 : 0;
    const bChild = b.templateInspectionId ? 1 : 0;
    return aChild - bChild || a.sortOrder - b.sortOrder;
  });

  for (const inspection of orderedInspections) {
    await prisma.inspection.upsert({
      where: { id: inspection.id },
      update: {
        title: inspection.title,
        description: inspection.description,
        category: inspection.category,
        href: inspection.href,
        equipmentLabel: inspection.equipmentLabel ?? null,
        templateInspectionId: inspection.templateInspectionId ?? null,
        fixedEquipmentRef: inspection.fixedEquipmentRef ?? null,
        isAvailable: inspection.isAvailable,
        sortOrder: inspection.sortOrder,
      },
      create: {
        id: inspection.id,
        slug: inspection.slug,
        title: inspection.title,
        description: inspection.description,
        category: inspection.category,
        href: inspection.href,
        equipmentLabel: inspection.equipmentLabel ?? null,
        templateInspectionId: inspection.templateInspectionId ?? null,
        fixedEquipmentRef: inspection.fixedEquipmentRef ?? null,
        isAvailable: inspection.isAvailable,
        sortOrder: inspection.sortOrder,
      },
    });

    if (inspection.templateInspectionId) {
      continue;
    }

    for (const question of inspection.questions) {
      await prisma.inspectionQuestion.upsert({
        where: { id: question.id },
        update: {
          inspectionId: inspection.id,
          label: question.label,
          helpText: question.helpText ?? null,
          sectionTitle: question.sectionTitle ?? null,
          type: question.type,
          options:
            questionTypeStoresOptions(question.type) ? question.options : Prisma.DbNull,
          attentionValues: question.attentionValues,
          required: question.required,
          showLastValue: question.showLastValue,
          applicableEquipmentRefs:
            question.applicableEquipmentRefs.length > 0
              ? question.applicableEquipmentRefs
              : Prisma.DbNull,
          applicableShifts:
            question.applicableShifts.length > 0
              ? question.applicableShifts
              : Prisma.DbNull,
          firstOfWeekOnly: question.firstOfWeekOnly,
          isActive: true,
          sortOrder: question.sortOrder,
        },
        create: {
          id: question.id,
          inspectionId: inspection.id,
          label: question.label,
          helpText: question.helpText ?? null,
          sectionTitle: question.sectionTitle ?? null,
          type: question.type,
          options:
            questionTypeStoresOptions(question.type) ? question.options : Prisma.DbNull,
          attentionValues: question.attentionValues,
          required: question.required,
          showLastValue: question.showLastValue,
          applicableEquipmentRefs:
            question.applicableEquipmentRefs.length > 0
              ? question.applicableEquipmentRefs
              : Prisma.DbNull,
          applicableShifts:
            question.applicableShifts.length > 0
              ? question.applicableShifts
              : Prisma.DbNull,
          firstOfWeekOnly: question.firstOfWeekOnly,
          isActive: true,
          sortOrder: question.sortOrder,
        },
      });
    }
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

  console.log(`Seeded ${POLYMER_ADIPIC_DETA_PRODUCTS.length} calculations`);
  console.log(
    `Seeded ${INSPECTION_DEFINITIONS.length} inspections with questions`,
  );

  await ensureRolesAndSignOffDefaults();

  const hsolenisOperatorRole = await prisma.role.findUnique({
    where: { slug: HSOLENIS_OPERATOR_ROLE_SLUG },
    select: { id: true },
  });
  const operatorUser = await prisma.user.findUnique({
    where: { email: operatorEmail },
    select: { id: true },
  });
  if (hsolenisOperatorRole && operatorUser) {
    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: {
          userId: operatorUser.id,
          roleId: hsolenisOperatorRole.id,
        },
      },
      update: {},
      create: {
        userId: operatorUser.id,
        roleId: hsolenisOperatorRole.id,
      },
    });
    console.log(`Assigned hSolenis Operator role to ${operatorEmail}`);
  }

  console.log("Ensured default roles and permit sign-off slots");
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
