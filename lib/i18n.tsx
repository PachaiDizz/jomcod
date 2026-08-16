"use client";

// Lightweight, dependency-free i18n for JomCOD.
//
//   const { t, lang, setLang } = useI18n();
//   t("common.save")                       // -> "Save" / "Simpan"
//   t("job.completedCount", { n: 5 })      // -> "5 jobs completed"
//
// Language is auto-detected once on mount (browser locale: ms* -> BM, else EN),
// then remembered in localStorage. Missing keys fall back to English, then to
// the key itself, so the app never shows a raw key.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { en } from "@/lib/i18n/en";
import { bm } from "@/lib/i18n/bm";

export type Lang = "en" | "bm";

const DICTS: Record<Lang, Record<string, string>> = { en, bm };
const STORAGE_KEY = "jomcod_lang";

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "bm") return saved;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("ms")) return "bm";
  } catch {
    // ignore storage/navigation errors
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(detectLang());
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = lang === "bm" ? "ms" : "en";
    } catch {
      // ignore
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) =>
      interpolate(DICTS[lang][key] ?? DICTS.en[key] ?? key, vars),
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
