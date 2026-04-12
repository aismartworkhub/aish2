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

export const metadata: Metadata = {
 title: {
   default: `${SITE_NAME} - ${SITE_FULL_NAME}`,
   template: `%s | ${SITE_NAME}`,
 },
 description: SITE_DESCRIPTION,
 keywords: ["AI 교육", "인공지능", "AISH", "스마트워크톤", "바이브 코딩", "데이터 분석"],
};

export default function RootLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
   <html lang="ko" suppressHydrationWarning>
     <body className={inter.className} suppressHydrationWarning>
       <Providers>{children}</Providers>
     </body>
   </html>
 );
}
