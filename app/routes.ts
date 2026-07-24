import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("approvals", "routes/approvals.tsx"),
  route("operators", "routes/operators.tsx"),
  route(
    "calculations/polymer-973-adipic-deta",
    "routes/polymer-973-adipic-deta.tsx",
  ),
  route(
    "calculations/polymer-an04-adipic-deta",
    "routes/polymer-an04-adipic-deta.tsx",
  ),
] satisfies RouteConfig;
