"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useHomeData } from "@/hooks/useHomeData";
import { loadSiteTheme, type HomeTemplate } from "@/lib/site-settings-public";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { cn } from "@/lib/utils";
import HomeDefault from "@/components/home/HomeDefault";
import HomeModern from "@/components/home/HomeModern";
import HomeCommunity from "@/components/home/HomeCommunity";

export default function HomePage() {
  const [template, setTemplate] = useState<HomeTemplate>("default");
  const homeData = useHomeData();

  useEffect(() => {
    loadSiteTheme().then((t) => setTemplate(t.homeTemplate));
  }, []);

  // 모바일 풀투리프레시 — 매거진 섹션이라 reload로 충분 (캐시 30s도 비움)
  const ptr = usePullToRefresh({
    onRefresh: () => {
      if (typeof window !== "undefined") window.location.reload();
    },
  });

  const view = (() => {
    switch (template) {
      case "modern":
        return <HomeModern {...homeData} />;
      case "community":
        return <HomeCommunity {...homeData} />;
      default:
        return <HomeDefault {...homeData} />;
    }
  })();

  return (
    <>
      {(ptr.pullDistance > 0 || ptr.refreshing) && (
        <div
          className="pointer-events-none fixed left-1/2 top-16 z-30 -translate-x-1/2 rounded-full bg-white/95 p-2 shadow-lg backdrop-blur lg:hidden"
          style={{ transform: `translate(-50%, ${Math.max(0, ptr.pullDistance - 30)}px)` }}
          aria-hidden
        >
          <Loader2
            size={18}
            className={cn(
              "text-gray-600 transition-transform",
              ptr.refreshing && "animate-spin",
            )}
            style={{ transform: ptr.refreshing ? undefined : `rotate(${ptr.pullDistance * 4}deg)` }}
          />
        </div>
      )}
      {view}
    </>
  );
}
