import { redirect } from "react-router";
import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";

import {
  commitSession,
  getSession,
  sessionStorage,
} from "~/lib/session.server";
import {
  canManageManagers,
  canManageOperators,
  canReviewRuns,
  type UserRole,
} from "~/lib/roles";
import {
  findAuthUserById,
  verifyLogin,
  type AuthUser,
} from "~/lib/user.server";

export const authenticator = new Authenticator<AuthUser>();

authenticator.use(
  new FormStrategy(async ({ form }) => {
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    return verifyLogin(email, password);
  }),
  "user-pass",
);

export { sessionStorage };

export async function getUser(request: Request): Promise<AuthUser | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const sessionUser = session.get("user") as AuthUser | undefined;
  if (!sessionUser?.id) {
    return null;
  }

  // Refresh from DB so role changes apply without forcing a re-login.
  const fresh = await findAuthUserById(sessionUser.id);
  return fresh ?? sessionUser;
}

export async function requireUser(
  request: Request,
  returnTo?: string,
): Promise<AuthUser> {
  const user = await getUser(request);
  if (user) {
    return user;
  }

  const session = await getSession(request.headers.get("Cookie"));
  if (returnTo) {
    session.set("returnTo", returnTo);
  }

  throw redirect("/login", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function requireRole(
  request: Request,
  roles: UserRole[],
  returnTo?: string,
): Promise<AuthUser> {
  const user = await requireUser(request, returnTo);
  if (!roles.includes(user.role)) {
    throw redirect("/");
  }
  return user;
}

export async function requireReviewer(
  request: Request,
  returnTo = "/approvals",
): Promise<AuthUser> {
  const user = await requireUser(request, returnTo);
  if (!canReviewRuns(user.role)) {
    throw redirect("/");
  }
  return user;
}

export async function requireOperatorManager(
  request: Request,
  returnTo = "/operators",
): Promise<AuthUser> {
  const user = await requireUser(request, returnTo);
  if (!canManageOperators(user.role)) {
    throw redirect("/");
  }
  return user;
}

export async function requireAdmin(
  request: Request,
  returnTo = "/managers",
): Promise<AuthUser> {
  const user = await requireUser(request, returnTo);
  if (!canManageManagers(user.role)) {
    throw redirect("/");
  }
  return user;
}

export async function createUserSession(request: Request, user: AuthUser) {
  const session = await getSession(request.headers.get("Cookie"));
  const returnTo = (session.get("returnTo") as string | undefined) ?? "/";
  session.unset("returnTo");
  session.set("user", user);

  return redirect(returnTo, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function logout(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
