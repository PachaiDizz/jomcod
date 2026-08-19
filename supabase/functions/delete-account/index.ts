// JomCOD — delete-account edge function
// Called from the Settings "Danger Zone" after the user types DELETE to
// confirm. Uses the service role to delete the authenticated user from
// auth.users — deleting the profile, jobs, reviews, notifications, push
// subscriptions, blocks and reports (all FK-cascade from auth.users).
//
// Guarded: only the signed-in user can delete themselves, and only when
// they have no active (pending/confirmed) jobs on either side of a request.
//
// Env vars (provided automatically on Supabase):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy with:
//   supabase functions deploy delete-account

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // The browser client sends the user's access token in Authorization.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Not signed in" }, 401);
  }

  // getUser() expects the raw JWT, not the "Bearer <token>" header value.
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return json({ error: "Not signed in" }, 401);
  }
  const userId = user.id;

  // Safety guard: never delete while jobs are in progress on either side.
  const { data: active, error: qErr } = await supabase
    .from("jobs")
    .select("id")
    .or(`requester_id.eq.${userId},runner_id.eq.${userId}`)
    .in("status", ["pending", "confirmed"])
    .limit(1);
  if (qErr) {
    return json({ error: "Couldn't check your jobs" }, 500);
  }
  if (active && active.length > 0) {
    return json({ error: "active-jobs" }, 409);
  }

  const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
  if (delErr) {
    return json({ error: delErr.message }, 500);
  }

  return json({ ok: true }, 200);
});
