import { useEffect, useState } from "react";
import { Form, Link, useLocation } from "react-router";
import { ChevronDownIcon, MenuIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
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

function DesktopNavGroup({
  group,
  location,
}: {
  group: NavGroupItem;
  location: { pathname: string; hash: string };
}) {
  const active = groupIsActive(location, group);
  const showSections = groupHasMultipleSections(group);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1 text-brand-navy hover:bg-muted hover:text-brand-navy",
            active && "bg-muted",
          )}
        >
          {group.label}
          <GroupBadge count={group.badge} />
          <ChevronDownIcon className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {group.children.map((child, index) => (
          <DropdownMenuGroup key={child.to}>
            {childStartsSection(group, index, showSections) && child.section ? (
              <>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuLabel>{child.section}</DropdownMenuLabel>
              </>
            ) : null}
            <DropdownMenuItem
              asChild
              className={cn(
                "items-start focus:bg-muted focus:text-brand-navy",
                pathMatches(location, child.to) && "bg-muted font-medium",
              )}
            >
              <Link to={child.to} className="flex flex-col gap-0.5">
                <span className="flex w-full items-center justify-between gap-2">
                  <span>{child.label}</span>
                  <GroupBadge count={child.badge} />
                </span>
                {child.description ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    {child.description}
                  </span>
                ) : null}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavChildLink({
  child,
  location,
  onNavigate,
}: {
  child: NavGroupChild;
  location: { pathname: string; hash: string };
  onNavigate: () => void;
}) {
  return (
    <Link
      to={child.to}
      onClick={onNavigate}
      className={cn(
        "block rounded-lg px-3 py-2.5 text-sm text-brand-navy no-underline hover:bg-muted hover:no-underline",
        pathMatches(location, child.to) && "bg-muted font-medium",
      )}
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

function MobileNavGroups({
  groups,
  location,
  onNavigate,
}: {
  groups: NavGroupItem[];
  location: { pathname: string; hash: string };
  onNavigate: () => void;
}) {
  const defaultOpen = groups
    .filter((group) => groupIsActive(location, group))
    .map((group) => group.id);

  return (
    <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
      {groups.map((group) => {
        const showSections = groupHasMultipleSections(group);

        return (
          <AccordionItem key={group.id} value={group.id} className="border-border/70">
            <AccordionTrigger className="px-1 text-brand-navy hover:no-underline">
              <span className="flex items-center gap-2">
                {group.label}
                <GroupBadge count={group.badge} />
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-1 [&_a]:no-underline">
              <div className="ml-1 grid gap-0.5 border-l border-border/70 pl-2">
                {group.children.map((child, index) => (
                  <div key={child.to}>
                    {childStartsSection(group, index, showSections) &&
                    child.section ? (
                      <p className="px-3 pt-2 pb-1 text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                        {child.section}
                      </p>
                    ) : null}
                    <MobileNavChildLink
                      child={child}
                      location={location}
                      onNavigate={onNavigate}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export function AppHeader({ user, pendingCount = 0 }: Props) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = buildNavItems({
    signedIn: Boolean(user),
    canReview: user ? canReviewRuns(user.role) : false,
    canManageOperators: user ? canManageOperators(user.role) : false,
    canManageUsers: user ? canManageUsers(user.role) : false,
    canManageRoles: user ? canManageRoles(user.role) : false,
    pendingCount,
  });
  const linkItems = navItems.filter((item) => item.type === "link");
  const groupItems = navItems.filter(
    (item): item is NavGroupItem => item.type === "group",
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

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

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
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
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <MenuIcon className="size-4" />
                Menu
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full gap-0 p-0 sm:max-w-sm"
            >
              <SheetHeader className="border-b border-border/70">
                <SheetTitle className="text-brand-navy">{APP_NAME}</SheetTitle>
                <SheetDescription>
                  Navigate plant tools and records.
                </SheetDescription>
              </SheetHeader>

              <nav
                className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-3"
                aria-label="Mobile"
              >
                {linkItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-brand-navy hover:bg-muted",
                      pathMatches(location, item.to) && "bg-muted",
                    )}
                  >
                    <span>{item.label}</span>
                    <GroupBadge count={item.badge} />
                  </Link>
                ))}

                {groupItems.length > 0 ? (
                  <MobileNavGroups
                    groups={groupItems}
                    location={location}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ) : null}
              </nav>

              {user ? (
                <SheetFooter className="border-t border-border/70">
                  <div className="text-sm text-muted-foreground">
                    {user.name ?? user.email}
                    <span className="ml-1 text-xs tracking-wide uppercase opacity-70">
                      ({user.role.toLowerCase()})
                    </span>
                  </div>
                  <Form method="post" action="/logout">
                    <Button type="submit" variant="outline" className="w-full">
                      Sign out
                    </Button>
                  </Form>
                </SheetFooter>
              ) : null}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
