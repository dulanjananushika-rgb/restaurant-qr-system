import mongoose, { type ClientSession } from "mongoose";

import { connectDB } from "@/lib/mongodb";

export async function runInTransaction<T>(
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  await connectDB();
  return mongoose.connection.transaction(operation, {
    readPreference: "primary",
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });
}
