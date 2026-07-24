import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", href: "/favicon.ico?v=2", sizes: "any" },
  { rel: "icon", href: "/icon.svg?v=2", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=2" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#072635" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Springvale Solenis" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="app-shell mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold text-brand-navy">
        {message}
      </h1>
      <p className="mt-2 text-muted-foreground">{details}</p>
      {stack ? (
        <pre className="mt-6 w-full overflow-x-auto rounded-lg bg-muted p-4 text-sm">
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  );
}
