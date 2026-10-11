import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { designTokensToCss } from "./design-tokens";

export function findDesignFile(start = process.cwd()): string {
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

export function readDesignCss(): string {
  return designTokensToCss(readFileSync(findDesignFile(), "utf8"));
}
