import type { Metadata } from "next";
import { Montserrat, Varela_Round } from "next/font/google";
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { Suspense } from "react";
import { CartProvider } from "@/shared/components/CartProvider";
import { ThemeVariables } from "@/components/theme-provider";
import { storeBranding } from "@/lib/constants/branding-store";
import "./globals.css";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || storeBranding.name
const siteDescription = process.env.NEXT_PUBLIC_SITE_DESCRIPTION || storeBranding.description
const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_SITE_URL || storeBranding.url

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-96x96.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: storeBranding.locale,
    siteName,
    title: siteName,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const montserrat = Montserrat({
  variable: "--font-montserrat",
  display: "swap",
  subsets: ["latin"],
});

const varelaRound = Varela_Round({
  variable: "--font-varela-round",
  weight: "400",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${montserrat.variable} ${varelaRound.variable} antialiased min-h-screen bg-background text-foreground font-montserrat`}>
        <ThemeVariables>
          <NextThemeProvider
            attribute="class"
            defaultTheme={storeBranding.theme.defaultTheme}
            enableSystem={false}
            disableTransitionOnChange
          >
            <Suspense fallback={<div className="h-16 border-b shadow-sm w-full top-0 bg-card" />}>
              <CartProvider>
                {children}
              </CartProvider>
            </Suspense>
          </NextThemeProvider>
        </ThemeVariables>
      </body>
    </html>
  );
}
