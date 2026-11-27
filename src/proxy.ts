import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Keeps the Supabase session fresh: if the access token has expired, this
// refreshes it and writes the new cookies before the page or route runs.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Nothing to refresh for someone who has never signed in.
  if (!url || !key || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });
  // Verifies the token and refreshes it when needed. Don't add code between
  // creating the client and this call.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|maplibre/|favicon.ico|share-image|manifest.webmanifest|icons/|opengraph-image|apple-icon|.*\\.(?:svg|png|jpg|jpeg|webp|ico|mjs)$).*)"],
};
