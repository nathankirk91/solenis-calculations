import { createCookieSessionStorage } from "react-router";

function getSessionSecrets(): string[] {
  const secret = process.env.SESSION_SECRET;
  if (secret) {
    return [secret];
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "SESSION_SECRET is not set. Set it in Vercel env vars for secure sessions.",
    );
  }

  return ["dev-only-change-me"];
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__solenis_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: getSessionSecrets(),
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;
