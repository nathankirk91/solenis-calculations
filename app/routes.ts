import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route(
    "calculations/polymer-973-adipic-deta",
    "routes/polymer-973-adipic-deta.tsx",
  ),
] satisfies RouteConfig;
