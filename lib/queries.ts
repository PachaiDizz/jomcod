import { JobRequest, Review, Runner, RunnerStatus, Service, AppNotification, ReportRow, AdminRunnerRow, AdminJobRow } from "./types";
import { createClient } from "@/lib/supabase/client";
import { normalizeWhatsApp, titleCase } from "./constants";

export interface LandingStats {
  activeRunners: number;
  available: number;
  busy: number;
  off: number;
  jobsThisMonth: number;
  avgRating: number;
}

export async function fetchLandingStats(): Promise<LandingStats> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_landing_stats");
  if (!error && data && typeof data === "object") {
    const d = data as Record<string, number>;
    return {
      activeRunners: d.active_runners ?? 0,
      available: d.available ?? 0,
      busy: d.busy ?? 0,
      off: d.off ?? 0,
      jobsThisMonth: d.jobs_this_month ?? 0,
      avgRating: d.avg_rating ?? 0,
    };
  }

  // Fallback if the RPC hasn't been created yet — compute what's publicly readable
  // (profiles + reviews are viewable by everyone; jobs is not, so it reads 0).
  const [profilesRes, reviewsRes] = await Promise.all([
    supabase.from("profiles").select("role,status").eq("role", "runner"),
    supabase.from("reviews").select("rating"),
  ]);
  const runners = (profilesRes.data ?? []) as { status: string | null }[];
  const available = runners.filter((r) => r.status === "available").length;
  const busy = runners.filter((r) => r.status === "busy" || r.status === "delivery").length;
  const off = runners.filter((r) => r.status === "offline").length;
  const reviews = (reviewsRes.data ?? []) as { rating: number }[];
  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return {
    activeRunners: runners.length - off,
    available,
    busy,
    off,
    jobsThisMonth: 0,
    avgRating,
  };
}

const AVATAR_COLORS = ["#2E6E62", "#E85D2C", "#C9961F", "#2C5E8A", "#8A6D00", "#7A4E3D"];

export interface ProfileRow {
  id: string;
  full_name: string | null;
  username: string | null;
  whatsapp: string | null;
  area: string | null;
  sahabat: string | null;
  no_rumah: string | null;
  block: string | null;
  role: string | null;
  status: string | null;
  services: unknown;
  schedule_from: string | null;
  schedule_to: string | null;
  last_seen_at?: string | null;
  availability_updated_at?: string | null;
  is_approved?: boolean;
  is_suspended?: boolean;
  is_admin?: boolean;
  created_at: string | null;
}

// Public discovery row — mirrors runner_profiles_public view. Never
// includes private fields (whatsapp, home address).
export interface RunnerPublicRow {
  id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
  status: string | null;
  area: string | null;
  services: unknown;
  schedule_from: string | null;
  schedule_to: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  is_approved?: boolean;
  is_suspended?: boolean;
  jobs_completed: number;
}

function displayName(p: { username: string | null; full_name: string | null }): string {
  return p.username || p.full_name || "Runner";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function toRunner(p: RunnerPublicRow): Runner {
  const name = displayName(p);
  let color = AVATAR_COLORS[0];
  for (let i = 0; i < name.length; i++) color = AVATAR_COLORS[(color.length + name.charCodeAt(i)) % AVATAR_COLORS.length];

  const services: Service[] = Array.isArray(p.services)
    ? (p.services as Service[]).map((s) => ({ ...s, name: titleCase(s.name) }))
    : [];

  // Transparency for available runners: how fresh is this "Available"?
  let statusNote: string | undefined;
  if (p.status === "available" && p.last_seen_at) {
    const mins = Math.floor((Date.now() - new Date(p.last_seen_at).getTime()) / 60000);
    if (mins <= 1) statusNote = "active now";
    else if (mins < 60) statusNote = `active ${mins}m ago`;
  }

  return {
    id: p.id,
    name,
    area: p.area ?? "",
    distanceKm: 0,
    avatarInitials: initials(name),
    avatarColor: color,
    status: (p.status as RunnerStatus) || "offline",
    statusNote,
    rating: null,
    jobsCompleted: p.jobs_completed ?? 0,
    acceptRate: null,
    services,
    milestones: [],
    reviews: [],
    whatsappNumber: "",
    scheduleFrom: p.schedule_from ?? undefined,
    scheduleTo: p.schedule_to ?? undefined,
    lastSeenAt: p.last_seen_at ?? null,
  };
}

export async function fetchRunners(): Promise<Runner[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("runner_profiles_public")
    .select("*")
    .eq("role", "runner")
    .eq("is_approved", true)
    .eq("is_suspended", false)
    .order("created_at", { ascending: false });

  if (error) return [];

  // Hide runners the current user has blocked.
  let blocked = new Set<string>();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: blk } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id);
    blocked = new Set((blk ?? []).map((b) => (b as { blocked_id: string }).blocked_id));
  }

  return (data ?? [])
    .filter((r) => !blocked.has((r as RunnerPublicRow).id))
    .map((r) => toRunner(r as RunnerPublicRow));
}

export async function fetchRunnerById(id: string): Promise<Runner | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("runner_profiles_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as RunnerPublicRow;
  if (row.role !== "runner") return null;
  return toRunner(row);
}

export async function upsertProfile(input: {
  role: string;
  whatsapp: string;
  area: string;
  username?: string;
  sahabat?: string;
  no_rumah?: string;
  block?: string;
  schedule_from?: string;
  schedule_to?: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: null };

  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name ?? metadata.name ?? "";

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    username: input.username ?? metadata.username ?? null,
    role: input.role,
    whatsapp: normalizeWhatsApp(input.whatsapp),
    area: input.area,
    sahabat: input.sahabat ?? metadata.sahabat ?? null,
    no_rumah: input.no_rumah ?? metadata.no_rumah ?? null,
    block: input.block ?? metadata.block ?? null,
    schedule_from: input.schedule_from ?? metadata.schedule_from ?? null,
    schedule_to: input.schedule_to ?? metadata.schedule_to ?? null,
  });
  return { error };
}

export async function getProfile(): Promise<ProfileRow | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as ProfileRow) ?? null;
}

export async function updateProfile(
  updates: Partial<ProfileRow>
): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const payload: Partial<ProfileRow> = { id: user.id, ...updates };
  if (updates.whatsapp !== undefined) payload.whatsapp = normalizeWhatsApp(updates.whatsapp ?? "");
  // Availability changes always stamp freshness timestamps so the runner
  // isn't immediately flagged as stale.
  if (updates.status !== undefined) {
    payload.last_seen_at = new Date().toISOString();
    payload.availability_updated_at = new Date().toISOString();
  }

  // Upsert instead of update: also creates the profile row if it's missing
  // (e.g. accounts created before the trigger), and works with RLS.
  const { error } = await supabase
    .from("profiles")
    .upsert(payload as ProfileRow);

  return !error;
}

interface JobRow {
  id: string;
  requester_id: string | null;
  runner_id: string | null;
  service_type: string | null;
  take_from: string | null;
  deliver_to: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
}

export function jobFromRow(
  row: Partial<JobRow> & { id: string }
): JobRequest {
  return {
    id: row.id,
    requesterId: row.requester_id ?? undefined,
    runnerId: row.runner_id ?? null,
    serviceType: row.service_type ?? "",
    takeFrom: row.take_from ?? "",
    deliverTo: row.deliver_to ?? "",
    notes: row.notes ?? "",
    status: (row.status as JobRequest["status"]) || "pending",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export interface JobActionResult {
  ok: boolean;
  message?: string;
}

export async function createJob(input: {
  serviceType: string;
  takeFrom: string;
  deliverTo: string;
  notes?: string;
  runnerId: string | null;
}): Promise<JobActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You must be signed in." };

  // Creation runs through create_request() server-side: it validates the
  // input and enforces duplicate/spam guards in the database.
  const { error } = await supabase.rpc("create_request", {
    p_service_type: input.serviceType,
    p_take_from: input.takeFrom,
    p_deliver_to: input.deliverTo,
    p_notes: input.notes ?? "",
    p_runner_id: input.runnerId,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchJobsForRunner(runnerId: string): Promise<JobRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("runner_id", runnerId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((r) => jobFromRow(r as JobRow));
}

export async function fetchOpenBroadcasts(): Promise<JobRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .is("runner_id", null)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((r) => jobFromRow(r as JobRow));
}

export async function claimBroadcast(jobId: string): Promise<JobActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("claim_broadcast", { p_job_id: jobId });
  if (error) return { ok: false, message: error.message };
  return { ok: data === true };
}

export async function acceptJob(jobId: string): Promise<JobActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_job", { p_job_id: jobId });
  if (error) return { ok: false, message: error.message };
  return { ok: data === true };
}

export async function declineJob(jobId: string): Promise<JobActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("decline_job", { p_job_id: jobId });
  if (error) return { ok: false, message: error.message };
  return { ok: data === true };
}

export async function markJobDone(jobId: string): Promise<JobActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("mark_job_done", { p_job_id: jobId });
  if (error) return { ok: false, message: error.message };
  return { ok: data === true };
}

// Writes/refreshes the "Total: RM…" line on a job's notes. Used to price a
// broadcast after a runner claims it (broadcast pricing varies by runner).
export async function setJobTotal(jobId: string, total: string): Promise<JobActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("set_job_total", {
    p_job_id: jobId,
    p_total: total,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: data === true };
}

export async function cancelJob(jobId: string): Promise<JobActionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cancel_job", { p_job_id: jobId });
  if (error) return { ok: false, message: error.message };
  return { ok: data === true };
}

// ---- Availability freshness (Phase 2) ----

export async function touchAvailability(): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("touch_availability");
}

export async function setAvailability(status: RunnerStatus): Promise<JobActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_availability", { p_status: status });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function refreshAvailability(): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("refresh_availability");
}

export async function expireStaleJobs(): Promise<void> {
  const supabase = createClient();
  await supabase.rpc("expire_stale_jobs");
}

export async function fetchJobsForRequester(requesterId: string): Promise<JobRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((r) => jobFromRow(r as JobRow));
}

export async function fetchJobById(id: string): Promise<JobRequest | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return jobFromRow(data as JobRow);
}

export interface Contact {
  name: string;
  whatsapp: string;
}

// Returns a user's name + (gated) WhatsApp number. The WhatsApp number is
// only shared with people who share an accepted/completed job with them —
// see the get_user_contact() Postgres function.
export async function fetchContact(userId: string): Promise<Contact | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_user_contact", { p_user_id: userId });
  if (error || !data) return null;
  const d = data as { name?: string; whatsapp?: string };
  return {
    name: d.name ?? "Runner",
    whatsapp: d.whatsapp ?? "",
  };
}

interface ReviewRow {
  id: string;
  job_id: string;
  runner_id: string | null;
  reviewer_id: string | null;
  author_name: string | null;
  rating: number;
  text: string | null;
  created_at: string | null;
}

export async function fetchReviewsForRunner(runnerId: string): Promise<Review[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("runner_id", runnerId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((r) => {
    const row = r as ReviewRow;
    return {
      id: row.id,
      authorName: row.author_name ?? "Community member",
      rating: row.rating,
      text: row.text ?? "",
    };
  });
}

export async function fetchReviewForJob(jobId: string): Promise<Review | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as ReviewRow;
  return {
    id: row.id,
    authorName: row.author_name ?? "Community member",
    rating: row.rating,
    text: row.text ?? "",
  };
}

export async function addReview(input: {
  jobId: string;
  runnerId: string;
  rating: number;
  text: string;
}): Promise<JobActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("add_review", {
    p_job_id: input.jobId,
    p_rating: input.rating,
    p_text: input.text,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// ---- Notifications hub (Phase 5) ----

export async function fetchNotifications(): Promise<AppNotification[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return [];
  return (data ?? []).map((n) => {
    const row = n as {
      id: string;
      kind: string;
      title: string;
      body: string | null;
      job_id: string | null;
      read: boolean;
      created_at: string;
    };
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body ?? "",
      jobId: row.job_id,
      read: row.read,
      createdAt: new Date(row.created_at).getTime(),
    };
  });
}

export async function fetchUnreadCount(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);
  return count ?? 0;
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
}

// ---- Reports (Phase 3) ----

export async function submitReport(input: {
  reportedId: string;
  reason: string;
  details?: string;
}): Promise<JobActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("submit_report", {
    p_reported_id: input.reportedId,
    p_reason: input.reason,
    p_details: input.details ?? "",
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// ---- Blocks (Phase 3) ----

export async function fetchBlockedIds(): Promise<string[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", user.id);
  return (data ?? []).map((b) => (b as { blocked_id: string }).blocked_id);
}

export async function blockUser(userId: string): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === userId) return false;
  const { error } = await supabase
    .from("blocks")
    .upsert({ blocker_id: user.id, blocked_id: userId });
  return !error;
}

export async function unblockUser(userId: string): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", userId);
  return !error;
}

// ---- Admin (Phase 3) ----

export async function adminListRunners(): Promise<AdminRunnerRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("admin_list_runners");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    area: r.area ? String(r.area) : null,
    status: r.status ? String(r.status) : null,
    isApproved: Boolean(r.is_approved),
    isSuspended: Boolean(r.is_suspended),
    createdAt: String(r.created_at),
  }));
}

export async function adminListJobs(): Promise<AdminJobRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("admin_list_jobs");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((j) => ({
    id: String(j.id),
    serviceType: String(j.service_type ?? ""),
    status: String(j.status),
    takeFrom: String(j.take_from ?? ""),
    deliverTo: String(j.deliver_to ?? ""),
    createdAt: String(j.created_at),
  }));
}

export async function adminListReports(): Promise<ReportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("admin_list_reports");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    reason: String(r.reason),
    details: String(r.details ?? ""),
    status: (r.status as ReportRow["status"]) ?? "open",
    createdAt: String(r.created_at),
    reporterName: String(r.reporter_name),
    reportedName: String(r.reported_name),
    reportedId: String(r.reported_id),
  }));
}

export async function adminSetApproved(userId: string, approved: boolean): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_approved", {
    p_user_id: userId,
    p_approved: approved,
  });
  return !error;
}

export async function adminSetSuspended(userId: string, suspended: boolean): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_suspended", {
    p_user_id: userId,
    p_suspended: suspended,
  });
  return !error;
}

export async function adminSetReportStatus(reportId: string, status: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_report_status", {
    p_report_id: reportId,
    p_status: status,
  });
  return !error;
}
