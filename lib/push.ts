import { createClient } from "@/lib/supabase/client";

// The VAPID public key is intentionally public (sent to every browser when
// subscribing). Hardcoded so it works even without a Vercel env var.
const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  "BLKb3BCfXiAhrtHxohH0mr17C1rm8O6d3bWYcadoZDFDys1X-qfvFrFfWL-NN1etl0WHxtaAj7XLEo7ZHWsEJTc";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

// Some browsers never settle these promises (e.g. iOS Safari before the PWA
// is installed to the home screen). Never let the UI hang — give up and
// report a readable message instead.
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  return (await getPushSubscription()) !== null;
}

// Ask for permission + subscribe + save the subscription to the DB.
export async function subscribeToPush(): Promise<{ ok: boolean; message?: string }> {
  if (!pushSupported()) {
    return { ok: false, message: "Push isn't available on this browser/device." };
  }
  try {
    const permission = await withTimeout(
      Notification.requestPermission(),
      8000,
      "Timed out waiting for the notification permission."
    );
    if (permission !== "granted") {
      return {
        ok: false,
        message:
          permission === "denied"
            ? "Notifications are blocked. Enable them in your browser settings."
            : "Notifications are off. If this is iPhone, install the app to your Home Screen first.",
      };
    }

    // Make sure the service worker is registered (don't rely on InstallPrompt
    // having finished). On iOS, navigator.serviceWorker.ready can hang even
    // after a successful register, so wait on the registration's own worker
    // state instead.
    const reg = await withTimeout(
      navigator.serviceWorker.register("/service-worker.js"),
      8000,
      "Timed out registering the service worker."
    );
    if (!reg.active) {
      await withTimeout(
        new Promise<void>((resolve) => {
          const check = () => {
            if (reg.active) resolve();
          };
          const target = reg.installing || reg.waiting;
          if (target) {
            target.addEventListener("statechange", check);
          } else {
            check();
          }
        }),
        10000,
        "The service worker didn't activate. Close and reopen the app once, then try again."
      );
    }

    const sub = await withTimeout(
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY
        ) as unknown as BufferSource,
      }),
      10000,
      "Timed out subscribing to notifications. Try again."
    );
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, message: "Couldn't read the push subscription." };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "You need to be signed in." };

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: "endpoint" }
    );
    return { ok: !error, message: error?.message };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't enable push notifications.",
    };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const sub = await getPushSubscription();
    if (sub) await sub.unsubscribe();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
    }
  } catch {
    // ignore cleanup errors
  }
}
