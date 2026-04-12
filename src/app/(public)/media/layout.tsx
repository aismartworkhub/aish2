import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "콘텐츠",
  description: "영상, 이미지, 자료 등 다양한 콘텐츠를 만나보세요.",
};

export default function MediaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
