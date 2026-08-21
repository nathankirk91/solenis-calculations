import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("temporal input stretch styles", () => {
  it("forces date/time controls to fill available width", () => {
    const css = readFileSync(join(root, "app/app.css"), "utf8");
    assert.match(css, /input\[type="date"\]/);
    assert.match(css, /input\[type="time"\]/);
    assert.match(css, /::-webkit-datetime-edit/);
    assert.match(css, /width:\s*100%/);

    const input = readFileSync(
      join(root, "app/components/ui/input.tsx"),
      "utf8",
    );
    assert.match(input, /temporalInputTypes/);
    assert.match(input, /\[&::-webkit-datetime-edit\]:w-full/);
  });
});
