import { redirect } from "react-router";

import type { Route } from "./+types/managers";

/** Legacy path — managers management moved to Users. */
export async function loader(_args: Route.LoaderArgs) {
  throw redirect("/users");
}

export default function ManagersRedirect() {
  return null;
}
