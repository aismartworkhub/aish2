import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SITE_NAME, SITE_FULL_NAME, SITE_DESCRIPTION } from "@/lib/constants";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({
 subsets: ["latin"],
 weight: ["300", "400", "700", "800"],
 display: "swap",
});

const SITE_URL = "https://aish-web-v2.web.app";
const OG_IMAGE = `${SITE_URL}/images/logo-aish-transparent.png`;

export const metadata: Metadata = {
 metadataBase: new URL(SITE_URL),
 title: {
   default: `${SITE_NAME} - ${SITE_FULL_NAME}`,
   template: `%s | ${SITE_NAME}`,
 },
 description: SITE_DESCRIPTION,
 keywords: ["AI 교육", "인공지능", "AISH", "스마트워크톤", "바이브 코딩", "데이터 분석"],
 // Phase 6 — Open Graph (KakaoTalk·Slack·Facebook 링크 미리보기)
 openGraph: {
   type: "website",
   locale: "ko_KR",
   url: SITE_URL,
   siteName: SITE_NAME,
   title: `${SITE_NAME} - ${SITE_FULL_NAME}`,
   description: SITE_DESCRIPTION,
   images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
 },
 // Phase 6 — Twitter Card (X.com 링크 미리보기)
 twitter: {
   card: "summary_large_image",
   title: `${SITE_NAME} - ${SITE_FULL_NAME}`,
   description: SITE_DESCRIPTION,
   images: [OG_IMAGE],
 },
};

export default function RootLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
   <html lang="ko" suppressHydrationWarning>
     <head>
       {/* 첫 콘텐츠 표시 가속 — 외부 도메인 DNS+TLS 사전 핸드셰이크 */}
       <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
       <link rel="preconnect" href="https://i.ytimg.com" />
       <link rel="preconnect" href="https://img.youtube.com" />
       <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
       <link rel="preconnect" href="https://drive.google.com" crossOrigin="anonymous" />
       <link rel="dns-prefetch" href="https://www.youtube.com" />
       <link rel="dns-prefetch" href="https://www.googleapis.com" />
     </head>
     <body className={inter.className} suppressHydrationWarning>
       <Providers>{children}</Providers>
     </body>
   </html>
 );
}
