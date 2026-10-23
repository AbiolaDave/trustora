import type { Types } from "mongoose";
import { AuditLog } from "@/models/audit-log";
/** Record sensitive admin/financial actions. Never put secrets or full personal data in before/after. */
export const audit = (actor: Types.ObjectId, action: string, targetType: string, targetId: unknown, before?: unknown, after?: unknown) =>
  AuditLog.create({ actor, action, targetType, targetId: String(targetId), before, after });
