import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  connectDB: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ verifyToken: mocks.verifyToken }));
vi.mock("@/lib/mongodb", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/User", () => ({
  default: { findOne: mocks.findOne },
}));

import { requireApiUser } from "@/lib/api/auth";

function request(method = "GET", cookie = "") {
  return new Request("https://restaurant.test/api/admin/menu", {
    method,
    headers: {
      host: "restaurant.test",
      ...(cookie ? { cookie } : {}),
      ...(method === "GET" ? {} : { origin: "https://restaurant.test" }),
    },
  });
}

describe("API authorization guard", () => {
  beforeEach(() => {
    mocks.verifyToken.mockReset();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.findOne.mockReset();
  });

  it("returns 401 when the session cookie is missing", async () => {
    const result = await requireApiUser(request(), ["ADMIN"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("rejects cross-origin mutations before database access", async () => {
    const foreign = new Request("https://restaurant.test/api/admin/menu", {
      method: "POST",
      headers: {
        host: "restaurant.test",
        origin: "https://attacker.test",
        cookie: "restaurant_token=token",
      },
    });
    const result = await requireApiUser(foreign, ["ADMIN"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(mocks.connectDB).not.toHaveBeenCalled();
  });

  it("rejects a valid token with the wrong role", async () => {
    mocks.verifyToken.mockReturnValue({
      id: "1",
      name: "Waiter",
      email: "w@example.com",
      role: "WAITER",
    });
    const result = await requireApiUser(
      request("GET", "restaurant_token=token"),
      ["ADMIN"]
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("re-checks active role state in the database", async () => {
    mocks.verifyToken.mockReturnValue({
      id: "507f1f77bcf86cd799439011",
      name: "Admin",
      email: "a@example.com",
      role: "ADMIN",
    });
    mocks.findOne.mockReturnValue({
      select: () => ({ lean: async () => null }),
    });
    const result = await requireApiUser(
      request("GET", "restaurant_token=token"),
      ["ADMIN"]
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("returns the database-backed active user", async () => {
    mocks.verifyToken.mockReturnValue({
      id: "507f1f77bcf86cd799439011",
      name: "Old Name",
      email: "old@example.com",
      role: "ADMIN",
    });
    mocks.findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: { toString: () => "507f1f77bcf86cd799439011" },
          name: "Current Admin",
          email: "admin@example.com",
          role: "ADMIN",
          status: "ACTIVE",
        }),
      }),
    });
    const result = await requireApiUser(
      request("POST", "restaurant_token=token"),
      ["ADMIN"]
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.name).toBe("Current Admin");
  });
});
