"use client";

import PhoneFrame from "@/components/PhoneFrame";
import Md from "@/components/Md";
import { useI18n } from "@/lib/i18n";

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <div className="text-[26px] md:text-[34px] font-bold font-display mb-1">
          {t("about.title")}
        </div>
        <div className="text-[15px] text-teal font-semibold">{t("about.tagline")}</div>
      </div>

      <PhoneFrame>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250]">
          <Md text={t("about.intro1")} />
        </p>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250] mt-3">
          <Md text={t("about.intro2")} />
        </p>
      </PhoneFrame>

      <PhoneFrame>
        <h2 className="text-[17px] font-bold font-display mb-2.5">{t("about.why")}</h2>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250]">
          <Md text={t("about.why1")} />
        </p>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250] mt-3">
          <Md text={t("about.why2")} />
        </p>
        <div className="mt-3.5 rounded-[10px] bg-[#E4F3EC] border border-[#C8E6DA] px-3.5 py-2.5 text-[13.5px] font-semibold text-teal">
          <Md text={t("about.motto")} />
        </div>
      </PhoneFrame>

      <PhoneFrame>
        <h2 className="text-[17px] font-bold font-display mb-2.5">{t("about.community")}</h2>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250]">
          <Md text={t("about.community1")} />
        </p>
        <div className="mt-3 rounded-xl border border-teal/30 bg-teal/[0.06] px-4 py-3">
          <div className="font-bold mb-1.5 text-[13.5px]">{t("about.locations")}</div>
          <ul className="list-disc pl-5 space-y-1 text-[13px]">
            <li>{t("guide.area1")}</li>
            <li>{t("guide.area2")}</li>
          </ul>
        </div>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250] mt-3">
          <Md text={t("about.community2")} />
        </p>
      </PhoneFrame>

      <PhoneFrame>
        <h2 className="text-[17px] font-bold font-display mb-2.5">{t("about.story")}</h2>
        <div className="rounded-[10px] bg-paper2 border border-line px-3.5 py-2.5 text-[12.5px] font-mono text-slate leading-relaxed mb-3">
          <Md text={t("about.storyTimeline")} />
        </div>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250]">
          <Md text={t("about.story2")} />
        </p>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250] mt-3">
          <Md text={t("about.story3")} />
        </p>
        <p className="text-[13.5px] leading-relaxed text-ink font-medium mt-3">
          <Md text={t("about.story4")} />
        </p>
      </PhoneFrame>

      <PhoneFrame>
        <h2 className="text-[17px] font-bold font-display mb-2.5">{t("about.help")}</h2>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250]">
          <Md text={t("about.help1")} />
        </p>
        <p className="text-[13.5px] leading-relaxed text-[#4B5250] mt-2">
          <Md text={t("about.help2")} />
        </p>
        <div className="grid gap-2 mt-4">
          <a
            href="https://wa.me/601116266163?text=Hi%20JomCOD%20Admin"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[10px] px-4 py-3 text-[12.5px] font-semibold text-center bg-orange text-white hover:bg-orange/90 transition-colors"
          >
            💬 {t("about.contactAdmin")}
          </a>
          <a
            href="https://wa.me/601116266163?text=Feedback%3A%20"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[10px] px-4 py-3 text-[12.5px] font-semibold text-center bg-white border border-line hover:border-ink transition-colors"
          >
            {t("about.sendFeedback")}
          </a>
          <a
            href="https://wa.me/601116266163?text=Problem%3A%20"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[10px] px-4 py-3 text-[12.5px] font-semibold text-center bg-white border border-line hover:border-ink transition-colors"
          >
            {t("about.reportProblem")}
          </a>
        </div>
      </PhoneFrame>

      <PhoneFrame>
        <h2 className="text-[17px] font-bold font-display mb-2.5">{t("about.appInfo")}</h2>
        <div className="flex items-center justify-between text-[13px] border-b border-line pb-2.5 mb-2.5">
          <span className="text-slate">{t("about.appName")}</span>
          <span className="font-mono font-bold text-ink">{t("about.version")}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-slate">{t("about.copyright")}</span>
          <span className="text-teal font-semibold">{t("about.madeWith")}</span>
        </div>
      </PhoneFrame>
    </div>
  );
}
