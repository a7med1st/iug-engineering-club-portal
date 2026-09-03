import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import ConditionalFooter from "@/components/ConditionalFooter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import IntroGate from "@/components/IntroGate";
import NavigationTransitionProvider from "@/components/navigation/NavigationTransitionProvider";
import ScrollReveal from "@/components/ScrollReveal";
import { CspNonceProvider } from "@/components/security/CspNonce";
import { getCspNonce } from "@/lib/csp-nonce";

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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = await getCspNonce();

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
  <head>
    <link rel="icon" href="/images/club-logo.png" type="image/png" />
    <link rel="shortcut icon" href="/images/club-logo.png" type="image/png" />
    <link rel="apple-touch-icon" href="/images/club-logo.png" />
    <script
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeBootScript }}
    />
  </head>

  <body>
    <CspNonceProvider nonce={nonce}>
      <IntroGate />
      <NavigationTransitionProvider />
      <ScrollReveal />
      <Header />
<main data-page-transition-content>
  {children}
</main>

<ConditionalFooter>
  <Footer />
</ConditionalFooter>
      <div id="app-portal-root" />
    </CspNonceProvider>
  </body>
</html>
  );
}
