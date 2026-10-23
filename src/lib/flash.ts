import { redirect } from "next/navigation";
/** Server actions finish by redirecting with a message in the URL, so every form works with no client JavaScript. */
const withMsg = (path: string, key: "error" | "ok", msg: string) => `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`;
export const fail = (path: string, msg: string): never => redirect(withMsg(path, "error", msg));
export const done = (path: string, msg: string): never => redirect(withMsg(path, "ok", msg));
