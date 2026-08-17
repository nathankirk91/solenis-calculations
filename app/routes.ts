import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("approvals", "routes/approvals.tsx"),
  route("operators", "routes/operators.tsx"),
  route("users", "routes/users.tsx"),
  route("roles", "routes/roles.tsx"),
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
  route("inspections", "routes/inspections.tsx"),
  route("permits", "routes/permits.tsx"),
  route("permits/dashboard", "routes/permits-dashboard.tsx"),
  route("permits/history", "routes/permits-history.tsx"),
  route("permits/manage", "routes/permits-manage.tsx"),
  route(
    "permits/manage/:inspectionId",
    "routes/permits-manage-detail.tsx",
  ),
  route("permits/settings", "routes/permits-settings.tsx"),
  route("permits/runs/:permitRunId/pdf", "routes/permit-run-pdf.tsx"),
  route("permits/runs/:permitRunId", "routes/permit-run.tsx"),
  route("permits/:permitId", "routes/permit-page.tsx"),
  route("inspections/history", "routes/inspections-history.tsx"),
  route("inspections/manage", "routes/inspections-manage.tsx"),
  route(
    "inspections/manage/:inspectionId",
    "routes/inspections-manage-detail.tsx",
  ),
  route("inspections/forklifts", "routes/inspections-forklifts.tsx"),
  route(
    "inspections/submissions/:runId/pdf",
    "routes/inspection-submission-pdf.tsx",
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
  route(
    "inspections/:inspectionId/week-status",
    "routes/inspection-week-status.tsx",
  ),
  route("inspections/:inspectionId", "routes/inspection-page.tsx"),
] satisfies RouteConfig;
