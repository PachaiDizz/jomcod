"use client";

import { useEffect, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import RoleBadge from "@/components/RoleBadge";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
}

export default function NewsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");

  const FALLBACK: NewsItem[] = [
    { title: t("news.fallback1"), link: "/browse", source: "JomCOD", date: "" },
    { title: t("news.fallback2"), link: "/", source: "JomCOD", date: "" },
  ];

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setRole((data.user?.user_metadata?.role as string) ?? ""))
      .catch(() => {});
  }, []);

  const loadNews = async () => {
    setError("");
    setItems(null);
    try {
      const url = encodeURIComponent(
        "https://news.google.com/rss/search?q=malaysia+community&hl=en-MY&gl=MY&ceid=MY:en"
      );
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${url}`);
      const data = await res.json();
      if (data?.status === "ok" && Array.isArray(data.items) && data.items.length > 0) {
        setItems(
          data.items.slice(0, 10).map((it: { title?: string; link?: string; author?: string; pubDate?: string }) => ({
            title: it.title ?? "",
            link: it.link ?? "#",
            source: it.author ?? "News",
            date: it.pubDate ?? "",
          }))
        );
      } else {
        setError(t("news.loadError"));
        setItems(FALLBACK);
      }
    } catch {
      setError(t("news.loadError"));
      setItems(FALLBACK);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await loadNews();
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <PhoneFrame>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <div className="text-[19px] md:text-[26px] font-bold font-display">{t("news.title")}</div>
        <RoleBadge role={role} />
      </div>
      <div className="text-[12.5px] text-slate mb-4.5">
        {t("news.sub")}
      </div>

      {error && (
        <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mb-3">
          {error} {t("news.placeholder")}{" "}
          <button onClick={loadNews} className="font-semibold underline">
            {t("common.tryAgain")}
          </button>
        </div>
      )}

      {!items ? (
        <div className="text-center py-10 text-[12.5px] text-slate">{t("news.loading")}</div>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target={item.link.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="block bg-white border border-line rounded-[10px] p-3.5 hover:border-orange transition-colors"
          >
            <div className="text-[13px] md:text-[14px] font-semibold leading-snug">{item.title}</div>
            <div className="flex items-center gap-2 mt-1.5 text-[10.5px] font-mono text-slate">
              <span>{item.source}</span>
              {item.date && (
                <>
                  <span>·</span>
                  <span>
                    {new Date(item.date).toLocaleDateString("en-MY", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </>
              )}
            </div>
          </a>
        ))}
        </div>
      )}

      <div className="text-[11.5px] text-slate bg-paper2 rounded-lg px-3 py-2.5 mt-2.5 italic">
        {t("news.note")}
      </div>
    </PhoneFrame>
  );
}
