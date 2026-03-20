import type { Metadata } from "next";
import { SITE_NAME, SITE_FULL_NAME, SITE_DESCRIPTION } from "@/lib/constants";
import "./globals.css";

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
   <html lang="ko">
     <body>{children}</body>
   </html>
 );
}
