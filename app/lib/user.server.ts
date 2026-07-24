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
