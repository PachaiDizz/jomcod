import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Routes that don't require an account.
  const isLanding = pathname === "/";
  const isAuthCallback = pathname.startsWith("/auth/callback");
  const isOnboarding = pathname === "/onboarding";

  if (!user && !isLanding && !isAuthCallback && !isOnboarding) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Both roles land on the dashboard — it's role-aware and shows the right
  // view for community and runner, so there's no role-specific home yet.
  const homeFor = () => "/dashboard";

  // Google (and older) users without a role must complete onboarding first.
  if (user && !user.user_metadata?.role && !isOnboarding) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  // Logged-in users with a role skip the landing page and go straight into the app.
  if (user && isLanding) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor();
    return NextResponse.redirect(url);
  }

  // Already set up — never show onboarding again.
  if (user && isOnboarding && user.user_metadata?.role) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor();
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$).*)",
  ],
};
