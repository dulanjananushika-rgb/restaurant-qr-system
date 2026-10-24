import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = join(process.cwd(), "src", "app", "api");
const protectedRoots = ["admin", "kitchen", "waiter", "cashier"];

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

describe("privileged route authorization coverage", () => {
  it("requires a database-backed API user in every role-protected route", () => {
    const missing = protectedRoots
      .flatMap((root) => routeFiles(join(apiRoot, root)))
      .filter((file) => !readFileSync(file, "utf8").includes("requireApiUser("));

    expect(missing).toEqual([]);
  });

  it("protects destructive and test-only utility endpoints", () => {
    for (const route of ["seed", "test-messages"]) {
      const source = readFileSync(join(apiRoot, route, "route.ts"), "utf8");
      expect(source).toContain("requireApiUser(");
    }
  });
});
