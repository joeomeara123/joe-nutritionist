import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Joe's Daily Nutrition",
    description: "A voice-first daily calorie and macro tracker built around Joe's food shop.",
    icons: {
      icon: [{ url: "/joe-gym-icon.svg", type: "image/svg+xml" }],
      shortcut: "/joe-gym-icon.svg",
    },
    openGraph: {
      title: "Joe's Daily Nutrition",
      description: "The whole day, in one circle.",
      type: "website",
      images: [`${origin}/og-v2.png`],
    },
    twitter: {
      card: "summary_large_image",
      title: "Joe's Daily Nutrition",
      description: "The whole day, in one circle.",
      images: [`${origin}/og-v2.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
