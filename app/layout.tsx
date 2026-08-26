import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import IntroGate from "@/components/IntroGate";
import NavigationTransitionProvider from "@/components/navigation/NavigationTransitionProvider";

export const metadata: Metadata = { title: "النادي الهندسي للطلاب | الجامعة الإسلامية بغزة", description: "بوابة النادي الهندسي للطلاب والأنشطة والأقسام." };

const themeBootScript = `
  (() => {
    try {
      const stored = localStorage.getItem("engineering-club-theme");
      const theme = stored === "dark" || stored === "light"
        ? stored
        : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/club-logo.png" type="image/png" />
        <link rel="shortcut icon" href="/images/club-logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/club-logo.png" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <IntroGate />
        <NavigationTransitionProvider />
        <Header />
        <main data-page-transition-content>{children}</main>
        <Footer />
        <div id="app-portal-root" />
      </body>
    </html>
  );
}
