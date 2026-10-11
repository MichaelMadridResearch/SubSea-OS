import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { designTokensToCss } from "./app/design-tokens.ts";

function findDesignFile(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    const candidate = path.join(dir, "DESIGN.md");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`DESIGN.md was not found from ${start}.`);
}

const source = readFileSync(findDesignFile(import.meta.dirname), "utf8");

test("the screen theme is generated from DESIGN.md", () => {
  const css = designTokensToCss(source);
  assert.match(css, /--color-primary:\s*#2563eb;/);
  assert.match(css, /--button-primary-background:\s*var\(--color-primary\);/);
  assert.match(css, /--font-body-family:\s*Inter;/);
  assert.match(css, /--radius-control:\s*6px;/);
});

test("editing the primary hex changes the generated CSS", () => {
  const css = designTokensToCss(source.replace("#2563eb", "#123456"));
  assert.match(css, /--color-primary:\s*#123456;/);
  assert.doesNotMatch(css, /--color-primary:\s*#2563eb;/);
});
