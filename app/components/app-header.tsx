import { useEffect, useId, useState } from "react";
import { Form, Link, useLocation } from "react-router";
import { MenuIcon, XIcon } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  canManageManagers,
  canManageOperators,
  canReviewRuns,
} from "~/lib/roles";
import type { AuthUser } from "~/lib/user.server";
import { cn } from "~/lib/utils";

type Props = {
  user?: AuthUser | null;
  pendingCount?: number;
};

type NavItem = {
  to: string;
  label: string;
  badge?: number;
};

export function AppHeader({ user, pendingCount = 0 }: Props) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const showApprovals = user ? canReviewRuns(user.role) : false;
  const showOperators = user ? canManageOperators(user.role) : false;
  const showManagers = user ? canManageManagers(user.role) : false;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  const navItems: NavItem[] = [
    { to: "/", label: "All calculators" },
    ...(user ? [{ to: "/history", label: "History" }] : []),
    ...(showApprovals
      ? [
          {
            to: "/approvals",
            label: "Approvals",
            badge: pendingCount > 0 ? pendingCount : undefined,
          },
        ]
      : []),
    ...(showOperators ? [{ to: "/operators", label: "Operators" }] : []),
    ...(showManagers ? [{ to: "/managers", label: "Managers" }] : []),
    ...(showApprovals ? [{ to: "/settings", label: "Settings" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="group min-w-0 flex-col">
          <span className="block text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Solenis
          </span>
          <span className="font-heading block truncate text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            Calculations
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Button
              key={item.to}
              asChild
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <Link to={item.to}>
                {item.label}
                {item.badge != null ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {item.badge}
                  </Badge>
                ) : null}
              </Link>
            </Button>
          ))}

          {user ? (
            <>
              <span className="ml-2 max-w-48 truncate text-sm text-muted-foreground">
                {user.name ?? user.email}
                <span className="ml-1 text-xs tracking-wide uppercase opacity-70">
                  ({user.role.toLowerCase()})
                </span>
              </span>
              <Form method="post" action="/logout">
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </Form>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          {!user ? (
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <XIcon className="size-4" />
            ) : (
              <MenuIcon className="size-4" />
            )}
            Menu
          </Button>
        </div>
      </div>

      <div
        id={menuId}
        className={cn(
          "border-t border-border/60 bg-background lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
            >
              <span>{item.label}</span>
              {item.badge != null ? (
                <Badge variant="secondary" className="tabular-nums">
                  {item.badge}
                </Badge>
              ) : null}
            </Link>
          ))}

          {user ? (
            <>
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {user.name ?? user.email}
                <span className="ml-1 text-xs tracking-wide uppercase opacity-70">
                  ({user.role.toLowerCase()})
                </span>
              </div>
              <Form method="post" action="/logout" className="px-3 pb-2">
                <Button type="submit" variant="outline" className="w-full">
                  Sign out
                </Button>
              </Form>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
