import bcrypt from "bcryptjs";

import { getPrisma } from "~/lib/db.server";
import type { UserRole } from "~/lib/roles";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

export async function verifyLogin(
  email: string,
  password: string,
): Promise<AuthUser> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password.");
  }

  return toAuthUser(user);
}

export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toAuthUser(user) : null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export type ManagedManager = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

export async function listManagers(): Promise<ManagedManager[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  return prisma.user.findMany({
    where: { role: "MANAGER" },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });
}

export async function createManager(args: {
  name: string;
  email: string;
  password: string;
}): Promise<ManagedManager> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const name = args.name.trim();
  const email = args.email.trim().toLowerCase();
  const password = args.password;

  if (!name) {
    throw new Error("Name is required.");
  }

  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required.");
  }

  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new Error("A user with that email already exists.");
  }

  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "MANAGER",
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });
}

function toAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
