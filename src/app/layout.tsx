import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Header, Footer } from "@/components/layout";
import { appConfig } from "@/lib/config";
import { getLocale } from "@/lib/i18n/server";
import { getThemeCookieValue } from "@/lib/i18n/theme-cookie";

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.canonicalUrl),
  title: {
    default: "Via Fidei · The Way of Faith",
    template: "%s · Via Fidei",
  },
  description:
    "A multilingual Catholic platform — prayers, saints, sacramental guidance, liturgy, and parish discovery — presented with reverence and clarity.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Via Fidei",
    description:
      "A multilingual Catholic companion — prayers, saints, liturgy, and parish discovery.",
    url: appConfig.canonicalUrl,
    siteName: "Via Fidei",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const theme = await getThemeCookieValue();
  // Admin pages have their own visual chrome (the admin login form's
  // brand header, the AdminSection layout). Showing the public site
  // navigation above them would imply the operator can still reach
  // /prayers, /saints, etc. from the admin console — they can, but the
  // mixed surface is confusing. Suppress the public Header/Footer on
  // any /admin route by reading the x-pathname header the middleware
  // sets on every request.
  const pathname = headers().get("x-pathname") ?? "";
  const isAdminRoute = pathname.startsWith("/admin");
  return (
    <html lang={locale} data-theme={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        {isAdminRoute ? null : <Header />}
        <main
          className={
            isAdminRoute
              ? "mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"
              : "mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-8 sm:px-6 sm:pt-12"
          }
        >
          {children}
        </main>
        {isAdminRoute ? null : <Footer />}
      </body>
    </html>
  );
}
