import type { ClientSession } from "mongoose";

import AuditLog from "@/models/AuditLog";

type AuditLogInput = {
  action: string;
  module: string;
  description: string;
  performedBy?: string;
  metadata?: Record<string, unknown>;
};

type AuditOptions = {
  session?: ClientSession;
  failClosed?: boolean;
};

export async function createAuditLog({
  action,
  module,
  description,
  performedBy = "System",
  metadata = {},
}: AuditLogInput, options: AuditOptions = {}) {
  try {
    const document = {
      action,
      module,
      description,
      performedBy,
      metadata,
    };

    if (options.session) {
      await AuditLog.create([document], { session: options.session });
    } else {
      await AuditLog.create(document);
    }
  } catch (error) {
    if (options.failClosed) throw error;
    console.error("Failed to create audit log:", error);
  }
}
