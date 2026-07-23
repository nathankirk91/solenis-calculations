import bcrypt from "bcryptjs";

import { getPrisma } from "~/lib/db.server";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
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

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
