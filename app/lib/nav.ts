export type NavLinkItem = {
  type: "link";
  to: string;
  label: string;
  badge?: number;
};

export type NavGroupChild = {
  to: string;
  label: string;
  description?: string;
  badge?: number;
  section?: string;
};

export type NavGroupItem = {
  type: "group";
  id: string;
  label: string;
  badge?: number;
  children: NavGroupChild[];
};

export type NavItem = NavLinkItem | NavGroupItem;

export type NavCapabilities = {
  signedIn: boolean;
  canReview: boolean;
  canManageOperators: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  pendingCount?: number;
};

export type PathLocation = {
  pathname: string;
  hash: string;
};

/** Hub pages should only match exactly so nested routes don't steal active state. */
const EXACT_ONLY_PATHS = new Set(["/", "/inspections", "/permits", "/history"]);

export function pathMatches(location: PathLocation, to: string) {
  const [targetPath = "/", targetHash = ""] = to.split("#");
  const hash = targetHash ? `#${targetHash}` : "";

  const pathOk = EXACT_ONLY_PATHS.has(targetPath)
    ? location.pathname === targetPath
    : location.pathname === targetPath ||
      location.pathname.startsWith(`${targetPath}/`);

  if (!pathOk) {
    return false;
  }

  if (!hash) {
    return true;
  }

  return location.hash === hash;
}

export function groupIsActive(location: PathLocation, group: NavGroupItem) {
  return group.children.some((child) => {
    const [targetPath = "/", targetHash = ""] = child.to.split("#");
    const hash = targetHash ? `#${targetHash}` : "";

    if (targetPath === "/") {
      return location.pathname === "/" && (!hash || location.hash === hash);
    }

    const pathOk =
      location.pathname === targetPath ||
      location.pathname.startsWith(`${targetPath}/`);
    if (!pathOk) {
      return false;
    }

    if (hash && location.hash) {
      return location.hash === hash;
    }

    return true;
  });
}

export function groupHasMultipleSections(group: NavGroupItem) {
  const sections = new Set(
    group.children
      .map((child) => child.section)
      .filter((section): section is string => Boolean(section)),
  );
  return sections.size > 1;
}

export function navLabels(items: NavItem[]) {
  return items.map((item) => item.label);
}

export function findNavGroup(items: NavItem[], id: string) {
  return items.find(
    (item): item is NavGroupItem => item.type === "group" && item.id === id,
  );
}

export function buildNavItems({
  signedIn,
  canReview,
  canManageOperators,
  canManageUsers,
  canManageRoles,
  pendingCount = 0,
}: NavCapabilities): NavItem[] {
  const approvalBadge = pendingCount > 0 ? pendingCount : undefined;

  const items: NavItem[] = [{ type: "link", to: "/", label: "Home" }];

  if (!signedIn) {
    return items;
  }

  items.push({
    type: "group",
    id: "permits",
    label: "Permits",
    children: [
      {
        to: "/permits/dashboard",
        label: "Dashboard",
        description: "Pending and open permits",
      },
      {
        to: "/permits",
        label: "Forms",
        description: "Issue a new permit",
      },
      {
        to: "/permits/history",
        label: "Records",
        description: "Open and closed permit history",
      },
      ...(canManageOperators
        ? [
            {
              to: "/permits/manage",
              label: "Manage",
              description: "Edit permit form templates",
            },
            {
              to: "/permits/settings",
              label: "Settings",
              description: "Who can sign each authorisation",
            },
          ]
        : []),
    ],
  });

  items.push({
    type: "group",
    id: "inspections",
    label: "Inspections",
    children: [
      {
        to: "/inspections",
        label: "Checklists",
        description: "Run equipment and shift checks",
      },
      {
        to: "/inspections/history",
        label: "Records",
        description: "Completed inspection history",
      },
      ...(canManageOperators
        ? [
            {
              to: "/inspections/manage",
              label: "Manage",
              description: "Edit inspection templates",
            },
          ]
        : []),
    ],
  });

  items.push({
    type: "group",
    id: "calculations",
    label: "Calculations",
    badge: canReview ? approvalBadge : undefined,
    children: [
      {
        to: "/#calculations",
        label: "Calculators",
        description: "Batch make-up calculators",
        section: "Calculators",
      },
      {
        to: "/history",
        label: "History",
        description: "Past submissions and approvals",
        section: "Calculators",
      },
      ...(canReview
        ? [
            {
              to: "/approvals",
              label: "Approvals",
              description: "Review pending calculation runs",
              section: "Approvals",
              badge: approvalBadge,
            },
          ]
        : []),
    ],
  });

  if (canReview) {
    items.push({
      type: "group",
      id: "settings",
      label: "Settings",
      children: [
        {
          to: "/settings",
          label: "Notifications",
          description: "Devices and alert types for this account",
        },
        ...(canManageUsers
          ? [
              {
                to: "/users",
                label: "Users",
                description: "Accounts and assigned roles",
              },
            ]
          : []),
        ...(canManageRoles
          ? [
              {
                to: "/roles",
                label: "Roles",
                description: "Create and edit access roles",
              },
            ]
          : []),
      ],
    });
  }

  return items;
}
