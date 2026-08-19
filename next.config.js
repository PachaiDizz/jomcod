/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // Derive the Supabase origin from env so the CSP stays correct if the
    // project moves; fall back to the current project URL.
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vjanzunjalhrghikqzsy.supabase.co";
    const supabaseOrigin = new URL(supabaseUrl).origin;
    const supabaseWss = supabaseOrigin.replace(/^http/, "ws");

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.googleusercontent.com",
      "font-src 'self' data:",
      `connect-src 'self' ${supabaseOrigin} ${supabaseWss} https://api.rss2json.com https://news.google.com`,
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
