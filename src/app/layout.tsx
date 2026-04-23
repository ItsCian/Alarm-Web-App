import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Alarm Remote System",
  description:
    "A Raspberry Pi–based alarm system with a custom PCB, controllable via this web interface",
  manifest: "/manifest.json",
  keywords: ["alarm", "security", "remote", "raspberry pi"],
  authors: [{ name: "Alarm Team" }],
  creator: "Alarm Team",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alarm Remote",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://alarm-remote.example.com",
    title: "Alarm Remote System",
    description: "Control your alarm system remotely",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans", outfit.variable)}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link
          rel="apple-touch-icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%23065f46' width='192' height='192' rx='48'/><text x='50%' y='50%' font-size='120' font-weight='bold' fill='%23ffffff' text-anchor='middle' dominant-baseline='central' font-family='system-ui, -apple-system, sans-serif'>A</text></svg>"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Alarm Remote" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="theme-color"
          content="#ffffff"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#1a1a1a"
          media="(prefers-color-scheme: dark)"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
