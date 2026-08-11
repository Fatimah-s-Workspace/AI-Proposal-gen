import { NextResponse, type NextRequest } from "next/server";

const isProd = process.env.NODE_ENV === "production";

// SHA-256 of the theme-init script inlined by src/app/layout.tsx and
// src/app/global-error.tsx. A hash rather than the nonce because that
// script's content is fixed and known ahead of time, and global-error
// renders when the root layout itself has failed - it shouldn't depend on
// anything being threaded down to it. Keep this in sync if that script
// ever changes; the theme-init CSP unit test fails loudly if it drifts.
const THEME_SCRIPT_HASH = "'sha256-F2c/WwLQKXGOjnrmlMcEqjiHXhMmXUxshHgStutLrEE='";

function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    // No 'unsafe-inline': Next's own streaming/bootstrap scripts carry the
    // per-request nonce (Next reads it back off this very header), and the
    // one inline script we author is covered by its hash. 'unsafe-eval'
    // stays in dev only, where webpack HMR and React Refresh need it.
    `script-src 'self' 'nonce-${nonce}' ${THEME_SCRIPT_HASH}${isProd ? "" : " 'unsafe-eval'"}`,
    // Still 'unsafe-inline': React sets element styles inline and Next
    // injects a critical-CSS <style> block, neither of which can carry a
    // nonce today. Far lower risk than inline script - it can't execute.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce);

  // Next reads the nonce out of the request's CSP header and stamps it onto
  // the script tags it emits, so this has to be set on the request as well
  // as the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Everything except static assets and image optimizer output - those are
  // served straight from disk and don't execute scripts, so running
  // middleware over them is pure overhead on every request.
  //
  // Deliberately NOT excluding prefetch requests. That exclusion is the
  // usual shape for auth-redirect middleware, but here it would hand
  // prefetched documents no CSP header, so Next renders them with an empty
  // nonce and hydration then mismatches against the client - which React
  // reports as "won't be patched up". Every document request needs the
  // header.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
