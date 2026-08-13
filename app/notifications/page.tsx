"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import RoleBadge from "@/components/RoleBadge";
import LoadingState from "@/components/LoadingState";
import { fetchNotifications, markAllNotificationsRead } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/lib/types";

const KIND_EMOJI: Record<string, string> = {
  new_request: "🔔",
  new_broadcast: "📣",
  accepted: "✅",
  done: "🎉",
  expired: "⏳",
  cancelled: "🚫",
  declined: "🙅",
};

function timeAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setRole((data.user?.user_metadata?.role as string) ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = await fetchNotifications();
      if (cancelled) return;
      setNotifs(list);
      setLoaded(true);
      // Visiting the hub clears the unread badge.
      markAllNotificationsRead();
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <PhoneFrame>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <div className="text-[19px] md:text-[26px] font-bold font-display">Notifications</div>
        <RoleBadge role={role} />
      </div>
      <div className="text-[12.5px] text-slate mb-4.5">
        Your request and job updates, all in one place.
      </div>

      {!loaded ? (
        <LoadingState label="Loading notifications…" />
      ) : notifs.length === 0 ? (
        <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-10">
          <div className="text-2xl mb-2.5">🔕</div>
          <div className="font-display font-bold text-[16px] mb-1">No notifications yet</div>
          <div className="text-[12px] text-slate leading-relaxed">
            When someone accepts your request, sends a broadcast, or marks a job done, it&apos;ll
            show up here.
          </div>
          <Link href="/browse" className="mt-4 inline-block bg-orange text-white rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold">
            Find a runner
          </Link>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {notifs.map((n) => {
            const body = (
              <div
                key={n.id}
                className="bg-white border border-line rounded-[10px] px-3.5 py-3 flex items-start gap-2.5 hover:border-[#C4BB9F] transition-colors"
              >
                <span className="text-lg leading-none flex-shrink-0 mt-0.5">
                  {KIND_EMOJI[n.kind] ?? "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-ink break-words">{n.title}</div>
                  {n.body && (
                    <div className="text-[11.5px] text-slate mt-0.5 leading-snug break-words">
                      {n.body}
                    </div>
                  )}
                  <div className="text-[10px] font-mono text-slate mt-1.5">
                    {timeAgo(n.createdAt)}
                  </div>
                </div>
              </div>
            );
            return n.jobId ? (
              <Link key={n.id} href={`/job/${n.jobId}`} className="block">
                {body}
              </Link>
            ) : (
              body
            );
          })}
        </div>
      )}
    </PhoneFrame>
  );
}
