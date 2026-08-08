import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import IntroGate from "@/components/IntroGate";

export const metadata: Metadata = { title: "النادي الهندسي للطلاب | الجامعة الإسلامية بغزة", description: "بوابة النادي الهندسي للطلاب والأنشطة والأقسام." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body><IntroGate/><Header/><main>{children}</main><Footer/></body></html>;
}
