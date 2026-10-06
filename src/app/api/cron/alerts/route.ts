import { timingSafeEqual } from "node:crypto";
import { runAlerts } from "@/lib/alerts";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Called daily by Vercel Cron with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = env.cronSecret();
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    given.length !== expected.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runAlerts();
  return Response.json(result);
}
