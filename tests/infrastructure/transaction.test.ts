import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

import { runInTransaction } from "@/lib/db/transaction";

describe("transaction boundary", () => {
  it("executes writes through the Mongoose transaction coordinator", async () => {
    const fakeSession = { id: "session" };
    const transaction = vi
      .spyOn(mongoose.connection, "transaction")
      .mockImplementation(async (operation) => operation(fakeSession as never));

    const operation = vi.fn().mockResolvedValue("committed");
    await expect(runInTransaction(operation)).resolves.toBe("committed");

    expect(operation).toHaveBeenCalledWith(fakeSession);
    expect(transaction).toHaveBeenCalledWith(
      operation,
      expect.objectContaining({
        readPreference: "primary",
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      })
    );
  });
});
