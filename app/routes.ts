import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("approvals", "routes/approvals.tsx"),
  route("operators", "routes/operators.tsx"),
  route("managers", "routes/managers.tsx"),
  route("admin/db-migrate", "routes/admin-db-migrate.tsx"),
  route("history", "routes/history.tsx"),
  route("settings", "routes/settings.tsx"),
  route("push/subscribe", "routes/push-subscribe.tsx"),
  route("submissions/:runId", "routes/submission.tsx"),
  route(
    "calculations/polymer-973-adipic-deta",
    "routes/polymer-973-adipic-deta.tsx",
  ),
  route(
    "calculations/polymer-an04-adipic-deta",
    "routes/polymer-an04-adipic-deta.tsx",
  ),
  route("inspections/manage", "routes/inspections-manage.tsx"),
  route(
    "inspections/manage/:inspectionId",
    "routes/inspections-manage-detail.tsx",
  ),
  route("inspections/submissions/:runId", "routes/inspection-submission.tsx"),
  route(
    "inspections/:inspectionId/last-answers",
    "routes/inspection-last-answers.tsx",
  ),
  route(
    "inspections/:inspectionId/open-actions",
    "routes/inspection-open-actions.tsx",
  ),
  route("inspections/:inspectionId", "routes/inspection-page.tsx"),
] satisfies RouteConfig;
