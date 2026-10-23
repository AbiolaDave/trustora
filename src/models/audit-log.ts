import mongoose, { Schema } from "mongoose";

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, index: true }, // e.g. "artisan.verify", "settings.update", "refund.initiate"
    targetType: String,
    targetId: String,
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
// Append-only by convention: no update/delete routes exist for this collection.
export const AuditLog = (mongoose.models.AuditLog || mongoose.model("AuditLog", auditSchema)) as unknown as import("mongoose").Model<Record<string, any>>;
