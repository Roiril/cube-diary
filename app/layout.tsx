import type { Metadata } from "next";

// この環境では next/font/google や globals.css の解決に失敗する場合があるため、
// 一時的にインポートを削除してビルドを通します。
// ローカル環境で開発する際は、必要に応じて再度追加してください。

export const metadata: Metadata = {
  title: "Cube Diary | 3D Photo Journal",
  description: "思い出を3Dキューブに残そう。Next.jsとThree.jsで作られた、新しい感覚の写真日記アプリ。",
  keywords: ["日記", "3D", "Three.js", "Next.js", "Supabase", "React Three Fiber", "個人開発"],
  openGraph: {
    title: "Cube Diary | 3D Photo Journal",
    description: "思い出を3Dキューブに残そう。ドラッグ＆ドロップで展開図を作る新しい日記体験。",
    type: "website",
    url: "https://cube-diary.vercel.app/", 
    images: [
      {
        url: "/CubeDiaryCap.png", // シェア時に表示される画像
        width: 630,
        height: 630,
      },
    ],
    locale: "ja_JP"
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
      {/* フォント設定を削除し、シンプルな構成に変更しました */}
      <body>
        {children}
      </body>
    </html>
  );
}