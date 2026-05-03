import type { Metadata } from "next";
import "./globals.css";
import { Header, Footer } from "@/components/layout";
import { getLocale } from "@/lib/i18n/server";
import { getThemeCookieValue } from "@/lib/i18n/theme-cookie";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.CANONICAL_URL || "https://viafidei.com"),
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
    url: "https://viafidei.com",
    siteName: "Via Fidei",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const theme = await getThemeCookieValue();
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
      <body>
        <Header />
        <main className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
