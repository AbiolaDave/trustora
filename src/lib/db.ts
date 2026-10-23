import mongoose from "mongoose";
import { requireEnv } from "./env";

// Cache the connection across hot reloads and serverless invocations.
const g = globalThis as unknown as {
  _mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};
const cache = (g._mongoose ??= { conn: null, promise: null });

export async function connectDb() {
  if (cache.conn) return cache.conn;
  const uri = requireEnv(
    "MONGODB_URI",
    "Create a free cluster on MongoDB Atlas and paste its connection string..",
  );
  cache.promise ??= mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 8000,
  });
  cache.conn = await cache.promise;
  return cache.conn;
}
