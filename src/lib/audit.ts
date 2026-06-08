import AuditLog from "@/models/AuditLog";

type AuditLogInput = {
  action: string;
  module: string;
  description: string;
  performedBy?: string;
  metadata?: Record<string, unknown>;
};

export async function createAuditLog({
  action,
  module,
  description,
  performedBy = "System",
  metadata = {},
}: AuditLogInput) {
  try {
    await AuditLog.create({
      action,
      module,
      description,
      performedBy,
      metadata,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}