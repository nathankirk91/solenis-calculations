import assert from "node:assert/strict";
import test from "node:test";

import { APP_NAME, pageTitle } from "./brand.ts";

test("pageTitle suffixes pages with the app name", () => {
  assert.equal(pageTitle("Home"), `Home | ${APP_NAME}`);
});

test("APP_NAME is Hercules 1612", () => {
  assert.equal(APP_NAME, "Hercules 1612");
});
