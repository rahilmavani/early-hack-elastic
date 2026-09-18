import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Providers } from "@/components/layout/Providers";
import { StorefrontChrome } from "@/components/layout/StorefrontChrome";
import { TelemetryProvider } from "@/lib/telemetry/TelemetryProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Northline",
    template: "%s · Northline",
  },
  description: "Considered clothing and footwear.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <TelemetryProvider />
        <Providers>
          <StorefrontChrome
            announcement={<AnnouncementBar />}
            header={<Header />}
            footer={<Footer />}
          >
            {children}
          </StorefrontChrome>
        </Providers>
      </body>
    </html>
  );
}
