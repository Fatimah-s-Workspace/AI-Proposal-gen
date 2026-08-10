import type { Metadata } from "next";
import Script from "next/script";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init-script";

// Required by the nonce-based CSP in src/middleware.ts. A prerendered page
// bakes its inline bootstrap scripts in at build time, when there's no
// request and therefore no nonce - the browser then blocks all of them and
// the page never hydrates. Verified: a static /auth/sign-in shipped 7
// nonce-less inline scripts against a nonce-requiring header.
//
// Set on the root layout so it covers every route, including ones added
// later. The alternative - serving static pages a weaker 'unsafe-inline'
// policy - would hand the weakest CSP to sign-in and sign-up, which is
// exactly backwards.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TenderFlow AI",
  description: "AI proposal, tender, and grant writing workspace for Nigeria and Africa."
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="font-sans">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
