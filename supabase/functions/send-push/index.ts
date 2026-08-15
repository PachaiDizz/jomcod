// JomCOD — send-push edge function
// Called by the DB trigger (jobs_notify → push_user) whenever a job event
// should produce a real phone notification. The trigger sends this function:
//   { target_user_id, kind, title, body, job_id }
// guarded by the `x-push-secret` header so random people can't spam pushes.
//
// Env vars required on this function:
//   PUSH_SECRET         — must match the value in public.app_secrets
//   VAPID_PUBLIC_KEY    — public Web Push key
//   VAPID_PRIVATE_KEY   — private Web Push key
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "npm:web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const secret = req.headers.get("x-push-secret");
  if (!secret || secret !== Deno.env.get("PUSH_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const targetUserId = body?.target_user_id;
  const title = body?.title;
  if (!targetUserId || !title) {
    return new Response("Bad Request", { status: 400 });
  }

  // VAPID keys: use env vars if set, otherwise fall back to the project's
  // generated keys (embedded here so the function always works even when the
  // dashboard secret store isn't picked up by the running deployment).
  const publicKey =
    Deno.env.get("VAPID_PUBLIC_KEY") ??
    "BLKb3BCfXiAhrtHxohH0mr17C1rm8O6d3bWYcadoZDFDys1X-qfvFrFfWL-NN1etl0WHxtaAj7XLEo7ZHWsEJTc";
  const privateKey =
    Deno.env.get("VAPID_PRIVATE_KEY") ??
    "BujH04qAIlAWEgqL3NaToKeMaH3djboeU6OuV2Jw3Nk";
  webpush.setVapidDetails("mailto:admin@jomcod.app", publicKey, privateKey);

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", targetUserId);

  const payload = JSON.stringify({
    title,
    body: body?.body ?? "",
    url: body?.job_id ? `/job/${body.job_id}` : "/",
  });

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      sent++;
    } catch (err) {
      // 404/410 = the subscription is dead (reinstalled app, cleared data).
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
