"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import RoleBadge from "@/components/RoleBadge";
import LoadingState from "@/components/LoadingState";
import { fetchNotifications, markAllNotificationsRead } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/lib/types";

const KIND_STYLE: Record<string, { emoji: string; tile: string; bar: string }> = {
  new_request: { emoji: "🔔", tile: "bg-[#FDF3EE]", bar: "bg-orange" },
  new_broadcast: { emoji: "📣", tile: "bg-[#FDF3EE]", bar: "bg-orange" },
  accepted: { emoji: "✅", tile: "bg-[#E4F3EC]", bar: "bg-teal" },
  done: { emoji: "🎉", tile: "bg-[#E4F3EC]", bar: "bg-teal" },
  expired: { emoji: "⏳", tile: "bg-[#FDF6E3]", bar: "bg-[#8A6D00]" },
  cancelled: { emoji: "🚫", tile: "bg-[#F1EFE8]", bar: "bg-[#9AA09C]" },
  declined: { emoji: "🙅", tile: "bg-[#F1EFE8]", bar: "bg-[#9AA09C]" },
};

const KIND_FALLBACK = { emoji: "🔔", tile: "bg-[#F1EFE8]", bar: "bg-[#9AA09C]" };

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
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {notifs.map((n) => {
            const style = KIND_STYLE[n.kind] ?? KIND_FALLBACK;
            const body = (
              <div
                key={n.id}
                className="bg-white border border-line rounded-card px-3.5 py-3 flex items-start gap-3 hover:border-[#C4BB9F] hover:shadow-[0_8px_24px_-12px_rgba(28,35,33,0.15)] transition-all overflow-hidden relative"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-[3.5px] ${style.bar}`} />
                <div
                  className={`w-9 h-9 rounded-[10px] ${style.tile} flex items-center justify-center text-[17px] flex-shrink-0`}
                >
                  {style.emoji}
                </div>
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
