import { NextResponse } from "next/server";
import { env } from "../../../../lib/env";
import { connectDb } from "../../../../lib/db";
import { sweep } from "../../../../server/booking/workflow";

export const dynamic = "force-dynamic";

/** Call every 10-15 minutes with header "Authorization: Bearer <CRON_SECRET>" (Vercel Cron, cron-job.org, etc.). */
export async function GET(req: Request) {
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) return new NextResponse("unauthorized", { status: 401 });
  await connectDb();
  return NextResponse.json(await sweep());
}
