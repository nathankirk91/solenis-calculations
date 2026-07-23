import { redirect } from "react-router";
import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";

import {
  commitSession,
  getSession,
  sessionStorage,
} from "~/lib/session.server";
import { verifyLogin, type AuthUser } from "~/lib/user.server";

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
  const user = session.get("user");
  return (user as AuthUser | undefined) ?? null;
}

export async function requireUser(
  request: Request,
  returnTo?: string,
): Promise<AuthUser> {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("user") as AuthUser | undefined;

  if (user) {
    return user;
  }

  if (returnTo) {
    session.set("returnTo", returnTo);
  }

  throw redirect("/login", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
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
