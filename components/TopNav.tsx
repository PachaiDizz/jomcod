"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchJobsForRunner, fetchUnreadCount } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import RoleBadge from "./RoleBadge";
import JoinGuideModal from "./JoinGuideModal";

const NAV = [
  { href: "/browse", key: "nav.browse" },
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/history", key: "nav.history" },
  { href: "/notifications", key: "nav.notifications" },
  { href: "/news", key: "nav.news" },
  { href: "/settings", key: "nav.settings" },
];

export default function TopNav() {
  const pathname = usePathname();
  const { t, lang, setLang } = useI18n();
  const [time, setTime] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState("");
  const [pendingJobs, setPendingJobs] = useState(0);
  const [unread, setUnread] = useState(0);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setSignedIn(!!data.user);
        setRole((data.user?.user_metadata?.role as string) ?? "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const teardown = () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const setupChannel = async () => {
      if (cancelled) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user || user.user_metadata?.role !== "runner") return;

      fetchJobsForRunner(user.id).then((list) =>
        setPendingJobs(list.filter((j) => j.status === "pending").length)
      );

      const name = `nav-jobs-${user.id}-${Date.now()}`;
      channel = supabase
        .channel(name)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "jobs",
            filter: `runner_id=eq.${user.id}`,
          },
          () => setPendingJobs((n) => n + 1)
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "jobs",
            filter: `runner_id=eq.${user.id}`,
          },
          (payload) => {
            const status = (payload.new as { status?: string }).status;
            setPendingJobs((n) => Math.max(0, n + (status === "pending" ? 1 : -1)));
          }
        )
        .subscribe();
    };

    setupChannel();

    return teardown;
  }, []);

  // Unread notification badge.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const load = async () => {
      const n = await fetchUnreadCount();
      if (!cancelled) setUnread(n);
    };
    load();
    const id = setInterval(load, 20000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [signedIn]);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    window.location.href = "/";
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 -mx-5 md:-mx-8 px-5 md:px-8 pt-3 md:pt-4 pb-2 md:pb-3 bg-paper/90 backdrop-blur border-b border-line mb-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex flex-col">
          <span className="font-display font-bold text-[20px] md:text-[22px] tracking-tight flex items-center gap-2">
            <span className="w-[9px] h-[9px] rounded-full bg-orange inline-block" />
            JomCOD
          </span>
          <span className="font-mono text-[11px] md:text-[12px] text-slate tracking-wide hidden sm:block">
            // community runners, near you
          </span>
        </Link>

        <div className="flex items-center justify-end gap-2.5 flex-wrap">
          <span className="font-mono text-[12px] text-slate hidden sm:inline">{time}</span>
          <div className="flex items-center gap-0.5 border border-line rounded-full p-0.5">
            {(["en", "bm"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  lang === l ? "bg-ink text-paper" : "text-slate hover:text-ink"
                }`}
                aria-pressed={lang === l}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          {signedIn && <RoleBadge role={role} />}
          {signedIn && (
            <button
              onClick={() => setShowGuide(true)}
              className="font-mono text-[11.5px] font-semibold text-slate border border-line rounded-full px-3 py-1.5 hover:bg-white transition-colors"
            >
              {t("nav.guide")}
            </button>
          )}
          {signedIn && (
            <button
              onClick={handleSignOut}
              className="font-mono text-[11.5px] font-semibold text-orange border border-orange/40 rounded-full px-3 py-1.5 hover:bg-orange hover:text-white transition-colors"
            >
              {t("nav.signOut")}
            </button>
          )}
        </div>
      </div>

      {signedIn && (
        <div className="md:mt-4 md:border-t md:border-line md:pt-3">
          <nav className="mt-3 md:mt-0 flex items-center gap-1.5 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`font-mono text-[11.5px] font-semibold rounded-full px-3 py-1.5 md:px-4 md:py-2 transition-colors flex items-center gap-1 whitespace-nowrap ${
                  isActive(item.href)
                    ? "bg-ink text-paper"
                    : "text-slate hover:text-ink hover:bg-white border border-transparent"
                }`}
              >
                {t(item.key)}
                {item.href === "/dashboard" && pendingJobs > 0 && (
                  <span className="bg-orange text-white rounded-full px-1.5 text-[10px] leading-4">
                    {pendingJobs}
                  </span>
                )}
                {item.href === "/notifications" && unread > 0 && (
                  <span className="bg-orange text-white rounded-full px-1.5 text-[10px] leading-4">
                    {unread}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {showGuide && (
        <JoinGuideModal onAccept={() => setShowGuide(false)} acceptLabel={t("guide.acceptNav")} />
      )}
    </header>
  );
}
