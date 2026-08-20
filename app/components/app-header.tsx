import { useEffect, useId, useRef, useState } from "react";
import { Form, Link, useLocation } from "react-router";
import { ChevronDownIcon, MenuIcon, XIcon } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { APP_NAME } from "~/lib/brand";
import {
  buildNavItems,
  groupHasMultipleSections,
  groupIsActive,
  pathMatches,
  type NavGroupChild,
  type NavGroupItem,
} from "~/lib/nav";
import {
  canManageOperators,
  canManageRoles,
  canManageUsers,
  canReviewRuns,
} from "~/lib/roles";
import type { AuthUser } from "~/lib/user.server";
import { cn } from "~/lib/utils";

type Props = {
  user?: AuthUser | null;
  pendingCount?: number;
};

function SolenisMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 89 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M4.10364 91.4189C4.67164 91.4189 47.0446 91.4189 47.6126 91.4189C74.6496 91.0982 99.9825 58.808 78.3984 36.6753C78.3984 40.9521 73.6272 44.9082 66.0159 47.5812C55.5647 51.3235 40.4558 54.9588 30.459 57.3111C24.6653 58.701 20.1213 60.8395 16.7133 65.4371C14.1005 69.0724 1.15002 86.6075 1.15002 86.6075C-0.553983 89.3874 0.809223 91.4189 4.10364 91.4189Z"
        fill="#00CC99"
      />
      <path
        d="M84.872 0C84.304 0 41.8174 0 41.2494 0C14.326 0.320763 -11.1205 32.7179 10.5772 54.7436C10.5772 50.4668 15.3484 46.5107 22.9597 43.8377C33.4109 40.0954 48.5198 36.4601 58.5166 34.1078C64.3103 32.7179 68.8543 30.5794 72.2623 25.9818C74.8751 22.3465 87.8256 4.81145 87.8256 4.81145C89.5296 2.0315 88.28 0.106921 84.9856 0.106921L84.872 0Z"
        fill="#00CC99"
      />
    </svg>
  );
}

function GroupBadge({ count }: { count?: number }) {
  if (count == null) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className="bg-brand/15 text-brand-navy tabular-nums"
    >
      {count}
    </Badge>
  );
}

function NavChildLink({
  child,
  onNavigate,
  className,
}: {
  child: NavGroupChild;
  onNavigate?: () => void;
  className: string;
}) {
  return (
    <Link
      to={child.to}
      role="menuitem"
      className={className}
      onClick={onNavigate}
    >
      <span className="flex items-center justify-between gap-2">
        <span>{child.label}</span>
        <GroupBadge count={child.badge} />
      </span>
      {child.description ? (
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
          {child.description}
        </span>
      ) : null}
    </Link>
  );
}

function GroupSectionHeading({
  label,
  divided,
}: {
  label: string;
  divided?: boolean;
}) {
  return (
    <div>
      {divided ? (
        <div className="mx-2 mt-1 mb-0.5 border-t border-border/70" />
      ) : null}
      <p className="px-3 pt-2 pb-1 text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
    </div>
  );
}

function childStartsSection(
  group: NavGroupItem,
  index: number,
  showSections: boolean,
) {
  if (!showSections) {
    return false;
  }

  const child = group.children[index];
  if (!child?.section) {
    return false;
  }

  return group.children[index - 1]?.section !== child.section;
}

function GroupChildren({
  group,
  onNavigate,
  linkClassName,
}: {
  group: NavGroupItem;
  onNavigate?: () => void;
  linkClassName: (child: NavGroupChild) => string;
}) {
  const showSections = groupHasMultipleSections(group);

  return group.children.map((child, index) => (
    <div key={child.to}>
      {childStartsSection(group, index, showSections) && child.section ? (
        <GroupSectionHeading label={child.section} divided={index > 0} />
      ) : null}
      <NavChildLink
        child={child}
        onNavigate={onNavigate}
        className={linkClassName(child)}
      />
    </div>
  ));
}

function DesktopNavGroup({
  group,
  location,
}: {
  group: NavGroupItem;
  location: { pathname: string; hash: string };
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = groupIsActive(location, group);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "gap-1 text-brand-navy hover:bg-muted hover:text-brand-navy",
          (open || active) && "bg-muted",
        )}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {group.label}
        <GroupBadge count={group.badge} />
        <ChevronDownIcon
          className={cn(
            "size-3.5 opacity-70 transition-transform",
            open && "rotate-180",
          )}
        />
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full left-0 z-50 mt-1 min-w-56 rounded-lg border border-border/80 bg-white p-1 shadow-md"
        >
          <GroupChildren
            group={group}
            onNavigate={() => setOpen(false)}
            linkClassName={(child) =>
              cn(
                "block rounded-md px-3 py-2 text-sm text-brand-navy transition-colors hover:bg-muted",
                pathMatches(location, child.to) && "bg-muted font-medium",
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function MobileNavGroup({
  group,
  location,
  defaultOpen,
}: {
  group: NavGroupItem;
  location: { pathname: string; hash: string };
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="rounded-lg">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-brand-navy hover:bg-muted"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2">
          {group.label}
          <GroupBadge count={group.badge} />
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 opacity-70 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          className="mb-1 ml-2 grid gap-0.5 border-l border-border/70 pl-2"
        >
          <GroupChildren
            group={group}
            linkClassName={(child) =>
              cn(
                "block rounded-lg px-3 py-2 text-sm text-brand-navy hover:bg-muted",
                pathMatches(location, child.to) && "bg-muted font-medium",
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export function AppHeader({ user, pendingCount = 0 }: Props) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const navItems = buildNavItems({
    signedIn: Boolean(user),
    canReview: user ? canReviewRuns(user.role) : false,
    canManageOperators: user ? canManageOperators(user.role) : false,
    canManageUsers: user ? canManageUsers(user.role) : false,
    canManageRoles: user ? canManageRoles(user.role) : false,
    pendingCount,
  });

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

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

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="group flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-navy p-1.5 shadow-sm transition-transform group-hover:scale-[1.02]">
            <SolenisMark className="size-full" />
          </span>
          <span className="min-w-0 flex-col">
            <span className="font-heading block truncate text-lg font-semibold tracking-tight text-brand-navy transition-colors group-hover:text-brand-navy/80">
              {APP_NAME}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) =>
            item.type === "link" ? (
              <Button
                key={item.to}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-2 text-brand-navy hover:bg-muted hover:text-brand-navy",
                  pathMatches(location, item.to) && "bg-muted",
                )}
              >
                <Link to={item.to}>
                  {item.label}
                  <GroupBadge count={item.badge} />
                </Link>
              </Button>
            ) : (
              <DesktopNavGroup
                key={item.id}
                group={item}
                location={location}
              />
            ),
          )}

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
          "border-t border-border/60 bg-white lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
          {navItems.map((item) =>
            item.type === "link" ? (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-brand-navy hover:bg-muted",
                  pathMatches(location, item.to) && "bg-muted",
                )}
              >
                <span>{item.label}</span>
                <GroupBadge count={item.badge} />
              </Link>
            ) : (
              <MobileNavGroup
                key={item.id}
                group={item}
                location={location}
                defaultOpen={groupIsActive(location, item)}
              />
            ),
          )}

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
