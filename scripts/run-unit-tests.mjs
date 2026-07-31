import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libDir = path.join(root, "app", "lib");

const files = readdirSync(libDir)
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join(libDir, name))
  .sort();

if (files.length === 0) {
  console.error("No unit tests found in app/lib/*.test.mjs");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const relative = path.relative(root, file);
  console.log(`\n> ${relative}`);
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", file],
    { stdio: "inherit", cwd: root },
  );
  if (result.status !== 0) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} unit test file(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${files.length} unit test file(s) passed`);
