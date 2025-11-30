import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css"; // ★ これが抜けていました！これでデザインが戻ります

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cube Diary | 3D Photo Journal",
  description: "思い出を3Dキューブに残そう。Next.jsとThree.jsで作られた、新しい感覚の写真日記アプリ。",
  keywords: ["日記", "3D", "Three.js", "Next.js", "Supabase", "React Three Fiber", "個人開発"],
  openGraph: {
    title: "Cube Diary | 3D Photo Journal",
    description: "思い出を3Dキューブに残そう。ドラッグ＆ドロップで展開図を作る新しい日記体験。",
    type: "website",
    // 公開URLが決まったら書き換えてください
    url: "https://cube-diary.vercel.app", 
    images: ["/images/CubeDiaryCap.png"], 
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}