"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import TimePicker from "@/components/TimePicker";
import JoinGuideModal from "@/components/JoinGuideModal";
import { createClient } from "@/lib/supabase/client";
import { isValidWhatsApp, normalizeWhatsApp } from "@/lib/constants";
import { fetchLandingStats } from "@/lib/queries";
import type { LandingStats } from "@/lib/queries";

export default function LandingPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<"community" | "runner">("community");

  const [stats, setStats] = useState<LandingStats | null>(null);

  const [oauthError, setOauthError] = useState("");

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setOauthError(err);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("jomcod_guide_ok") === "1") {
      setGuideAccepted(true);
    }
  }, []);

  const handleSignupTab = () => {
    setAuthMode("signup");
    if (!guideAccepted) setShowGuide(true);
  };

  const handleAcceptGuide = () => {
    setGuideAccepted(true);
    if (typeof window !== "undefined") window.localStorage.setItem("jomcod_guide_ok", "1");
    setShowGuide(false);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const s = await fetchLandingStats();
      if (mounted) setStats(s);
    };
    load();
    const timer = setInterval(load, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [sahabat, setSahabat] = useState("");
  const [noRumah, setNoRumah] = useState("");
  const [block, setBlock] = useState("");
  const [scheduleFrom, setScheduleFrom] = useState("");
  const [scheduleTo, setScheduleTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideAccepted, setGuideAccepted] = useState(false);

  const goToApp = (userRole?: string) => router.push("/dashboard");

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (err) setError(err.message);
  };

  const googleButton = (
    <>
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full rounded-[10px] px-4 py-3 text-[13.5px] font-semibold bg-white border border-line hover:border-ink transition-colors flex items-center justify-center gap-2 mb-3"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continue with Google
      </button>
      <div className="flex items-center gap-3 mb-3.5">
        <div className="flex-1 h-px bg-line" />
        <span className="text-[11px] font-mono text-slate">or</span>
        <div className="flex-1 h-px bg-line" />
      </div>
    </>
  );

  const handleSignIn = async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    goToApp(data.user?.user_metadata?.role);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError("");
    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isValidWhatsApp(trimmedPhone)) {
      setError("Enter a valid Malaysian WhatsApp number, e.g. 012-3456789.");
      setLoading(false);
      return;
    }
    const normalizedPhone = trimmedPhone ? normalizeWhatsApp(trimmedPhone) : "";
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          username: username || name,
          whatsapp: normalizedPhone,
          area,
          sahabat,
          no_rumah: noRumah,
          block,
          schedule_from: scheduleFrom,
          schedule_to: scheduleTo,
          role,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Email confirmations ON → no session yet, ask them to check their inbox.
    if (!data.session) {
      setEmailSent(true);
      return;
    }
    goToApp(role);
  };

  return (
    <div>
      {oauthError && (
        <div className="max-w-[460px] mx-auto mb-4 rounded-[10px] border border-orange/30 bg-[#FDEFE3] px-3.5 py-2.5 text-[12px] text-orange">
          <b>Sign-in error:</b> {oauthError}
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-7 items-start">
      {/* Hero */}
      <div className="bg-ink text-paper rounded-[20px] p-7 md:p-10">
        <div>
          <div className="font-mono text-[11.5px] text-yellow mb-3.5 tracking-wide">
            // Your Local Runner Network. Mudah, Pantas, Dipercayai. Dari Jiran untuk Jiran.
          </div>
          <h1 className="font-display text-[30px] md:text-[38px] leading-[1.12] font-bold max-w-[480px]">
            Someone nearby
            <br />
            can run this for you.
          </h1>
          <p className="text-[13.5px] text-[#C7CBC7] max-w-[440px] mt-3.5 leading-relaxed">
            Groceries, parcel pickups, or a quick errand — find a runner in
            your area and chat with them directly on WhatsApp.
          </p>
          <div className="flex gap-6 mt-6 flex-wrap font-mono text-[11px] text-[#9AA09C]">
            <div>
              <span className="block text-[20px] md:text-[24px] text-paper font-bold font-display">
                {stats?.activeRunners ?? 0}
              </span>
              active runners
            </div>
            <div>
              <span className="block text-[20px] md:text-[24px] text-paper font-bold font-display">
                {stats?.jobsThisMonth ?? 0}
              </span>
              jobs this month
            </div>
            <div>
              <span className="block text-[20px] md:text-[24px] text-paper font-bold font-display">
                {stats && stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
              </span>
              avg rating
            </div>
          </div>
        </div>
        <div className="mt-8 bg-white/[0.06] border border-white/10 rounded-2xl px-4.5 py-4">
          <div className="flex items-center justify-between text-xs mb-2 text-[#D8DBD6]">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal inline-block" /> Available now
            </span>
            <span className="font-mono text-[13px] font-bold text-paper">
              {stats?.available ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mb-2 text-[#D8DBD6]">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange inline-block" /> Busy on a job
            </span>
            <span className="font-mono text-[13px] font-bold text-paper">
              {stats?.busy ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-[#D8DBD6]">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B9B2A0] inline-block" /> Off for the day
            </span>
            <span className="font-mono text-[13px] font-bold text-paper">
              {stats?.off ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Auth */}
      <div className="max-w-[460px] w-full mx-auto">
        <div className="flex gap-1.5 mb-4 justify-center">
          <button
            onClick={() => setAuthMode("signin")}
            className={`font-mono text-[13px] font-semibold px-6 py-2.5 rounded-full border ${
              authMode === "signin"
                ? "bg-orange text-white border-orange"
                : "bg-paper text-slate border-line"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={handleSignupTab}
            className={`font-mono text-[13px] font-semibold px-6 py-2.5 rounded-full border ${
              authMode === "signup"
                ? "bg-orange text-white border-orange"
                : "bg-paper text-slate border-line"
            }`}
          >
            Sign up
          </button>
        </div>

        {emailSent ? (
          <PhoneFrame className="max-w-[460px]">
            <div className="text-[19px] font-bold mb-1 font-display">Check your email</div>
            <div className="text-[12.5px] text-slate mb-4.5">
              We sent a verification link to <b className="text-ink">{email}</b>. Click it to
              finish creating your account, then sign in.
            </div>
            <Button onClick={() => setEmailSent(false)} variant="outline">
              Back
            </Button>
          </PhoneFrame>
        ) : authMode === "signin" ? (
          <PhoneFrame className="max-w-[400px]">
            <div className="text-[19px] font-bold mb-1 font-display">Welcome back</div>
            <div className="text-[12.5px] text-slate mb-4.5">Sign in to JomCOD</div>
            {googleButton}
            <div className="mb-3.5">
              <label className="text-xs font-semibold mb-1.5 block">Email</label>
              <input
                type="email"
                className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mb-3.5">
              <label className="text-xs font-semibold mb-1.5 block">Password</label>
              <input
                type="password"
                className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mb-3">
                {error}
              </div>
            )}
            <Button onClick={handleSignIn} disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <div className="text-center text-xs text-slate mt-3.5">
              No account yet?{" "}
              <button className="text-teal font-semibold underline" onClick={handleSignupTab}>
                Sign up
              </button>
            </div>
          </PhoneFrame>
        ) : (
          <PhoneFrame className="max-w-[460px]">
            <div className="text-[19px] font-bold mb-1 font-display">Join JomCOD</div>
            <div className="text-[12.5px] text-slate mb-4.5">
              Choose how you&apos;ll use it — you can be both later
            </div>

            {googleButton}

            <div className="mb-2">
              <div className="text-xs font-semibold mb-1.5">I am signing up as a…</div>
              <div className="text-[11px] text-slate mb-3">
                🛵 Are you a runner who helps others? Choose <b className="text-ink">Runner</b>.
                <br />🏠 Just need help with errands? Choose <b className="text-ink">Community</b>.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={() => setRole("community")}
                className={`border-[1.5px] rounded-xl p-3.5 text-left transition-colors ${
                  role === "community" ? "border-orange bg-[#FDF3EE]" : "border-line bg-white"
                }`}
              >
                <div className="text-xl mb-1.5">🏠</div>
                <div className="font-bold text-[13px] mb-1">Community</div>
                <div className="text-[11px] text-slate leading-snug">
                  Request errands & parcel pickups nearby
                </div>
              </button>
              <button
                onClick={() => setRole("runner")}
                className={`border-[1.5px] rounded-xl p-3.5 text-left transition-colors ${
                  role === "runner" ? "border-orange bg-[#FDF3EE]" : "border-line bg-white"
                }`}
              >
                <div className="text-xl mb-1.5">🛵</div>
                <div className="font-bold text-[13px] mb-1">Runner</div>
                <div className="text-[11px] text-slate leading-snug">
                  Offer your service, set your price
                </div>
              </button>
            </div>

            <div className="mb-3.5">
              <label className="text-xs font-semibold mb-1.5 block">Full name</label>
              <input className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="mb-3.5">
              <label className="text-xs font-semibold mb-1.5 block">
                Username <span className="text-slate font-normal">(shown to neighbours)</span>
              </label>
              <input className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]" placeholder="e.g. speedyAhmad" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="mb-3.5">
              <label className="text-xs font-semibold mb-1.5 block">Email</label>
              <input type="email" className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="mb-3.5">
              <label className="text-xs font-semibold mb-1.5 block">Phone / WhatsApp Number</label>
              <input className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]" placeholder="e.g. 012-3456789" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="mb-3.5">
              <label className="text-xs font-semibold mb-1.5 block">Area / Neighbourhood</label>
              <input className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]" placeholder="e.g. Felda Desa Kencana" value={area} onChange={(e) => setArea(e.target.value)} />
              <div className="text-[10.5px] text-slate mt-1.5 mb-0">
                Your delivery address (optional) — prefilled when you request a service.
              </div>
            </div>
      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <div>
          <label className="text-[10.5px] font-semibold text-slate block mb-1">Sahabat</label>
          <input className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]" placeholder="e.g. 05" value={sahabat} onChange={(e) => setSahabat(e.target.value)} />
        </div>
        <div>
          <label className="text-[10.5px] font-semibold text-slate block mb-1">No. Rumah</label>
          <input className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]" placeholder="e.g. 203" value={noRumah} onChange={(e) => setNoRumah(e.target.value)} />
        </div>
        <div>
          <label className="text-[10.5px] font-semibold text-slate block mb-1">Block</label>
          <input className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]" placeholder="e.g. A" value={block} onChange={(e) => setBlock(e.target.value)} />
        </div>
      </div>
      {role === "runner" && (
        <div className="mb-3.5">
          <label className="text-xs font-semibold mb-1.5 block">
            Availability schedule (optional)
          </label>
          <div className="flex gap-2">
            <TimePicker
              value={scheduleFrom}
              onChange={setScheduleFrom}
              placeholder="From e.g. 8:00 AM"
            />
            <TimePicker
              value={scheduleTo}
              onChange={setScheduleTo}
              placeholder="To e.g. 5:00 PM"
            />
          </div>
        </div>
      )}
            <div className="mb-3.5">
              <label className="text-xs font-semibold mb-1.5 block">Password</label>
              <input type="password" className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {error && (
              <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mb-3">
                {error}
              </div>
            )}
            <Button onClick={handleSignUp} disabled={loading}>
              {loading
                ? "Creating account…"
                : role === "runner"
                ? "Continue to runner setup"
                : "Create community account"}
            </Button>
            <div className="text-center text-xs text-slate mt-3.5">
              Already registered?{" "}
              <button className="text-teal font-semibold underline" onClick={() => setAuthMode("signin")}>
                Sign in
              </button>
            </div>
          </PhoneFrame>
        )}
      </div>
      </div>

      {showGuide && <JoinGuideModal onAccept={handleAcceptGuide} />}
    </div>
  );
}
