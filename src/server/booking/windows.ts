import type { WorkingWindow } from "../../domain/availability";
/** Mongoose subdocuments -> plain working windows. */
export const toWindows = (w: ReadonlyArray<{ dayOfWeek?: number | null; startMinute?: number | null; endMinute?: number | null }> | undefined): WorkingWindow[] =>
  (w ?? []).filter((x) => x.dayOfWeek != null && x.startMinute != null && x.endMinute != null).map((x) => ({ dayOfWeek: x.dayOfWeek!, startMinute: x.startMinute!, endMinute: x.endMinute! }));
