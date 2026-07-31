import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "tests", "integration");

const files = readdirSync(dir)
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join(dir, name))
  .sort();

if (files.length === 0) {
  console.error("No integration tests found in tests/integration/*.test.mjs");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const relative = path.relative(root, file);
  console.log(`\n> ${relative}`);
  const result = spawnSync("npx", ["tsx", file], {
    stdio: "inherit",
    cwd: root,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} integration test file(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${files.length} integration test file(s) passed`);
