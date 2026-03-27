"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import Link from "next/link";
import { DEMO_QUICK_BANNERS, QuickBannerDemo } from "@/lib/demo-data";
import { getCollection, COLLECTIONS } from "@/lib/firestore";

const STYLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  INFO: { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200" },
  PROMOTION: { bg: "bg-primary-50", text: "text-primary-800", border: "border-primary-200" },
  WARNING: { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200" },
  EVENT: { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
};

export default function QuickBannerDisplay() {
  const currentPath = usePathname() || "/";
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [banners, setBanners] = useState<QuickBannerDemo[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    getCollection<QuickBannerDemo>(COLLECTIONS.BANNERS)
      .then((data) => setBanners(data.length > 0 ? data : DEMO_QUICK_BANNERS))
      .catch(() => setBanners(DEMO_QUICK_BANNERS));
  }, []);

  if (!mounted) return null;

  const now = new Date().toISOString().slice(0, 10);
  const activeBanners = banners.filter((b) => {
    if (!b.isActive) return false;
    if (!(b.targetPages || []).includes(currentPath)) return false;
    if (dismissed.has(b.id)) return false;
    if (b.startDate && now < b.startDate) return false;
    if (b.endDate && now > b.endDate) return false;
    return true;
  });

  if (activeBanners.length === 0) return null;

  // 상단 공간 충돌 방지: 최대 1개만 표시 (우선순위: 최신 배너)
  const visibleBanners = activeBanners.slice(0, 1);

  return (
    <div className="space-y-0">
      {visibleBanners.map((banner) => {
        const colors = STYLE_COLORS[banner.style] || STYLE_COLORS.INFO;
        const customBg = banner.backgroundColor
          ? { backgroundColor: banner.backgroundColor }
          : undefined;
        const customText = banner.textColor ? { color: banner.textColor } : undefined;

        return (
          <div
            key={banner.id}
            className={`${customBg ? "" : colors.bg} border-b ${colors.border} px-4 py-3`}
            style={customBg}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${customText ? "" : colors.text}`}
                  style={customText}
                >
                  <span className="font-bold">{banner.title}</span>
                  {banner.description && (
                    <span className="ml-2 font-normal opacity-80">{banner.description}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {banner.ctaText && banner.ctaLink && (
                  <Link
                    href={banner.ctaLink}
                    target={banner.ctaOpenNewTab ? "_blank" : undefined}
                    className={`text-sm font-semibold underline ${customText ? "" : colors.text}`}
                    style={customText}
                  >
                    {banner.ctaText}
                  </Link>
                )}
                {banner.isDismissible && (
                  <button
                    onClick={() => setDismissed((prev) => new Set(prev).add(banner.id))}
                    className={`p-1 rounded hover:bg-black/10 ${customText ? "" : colors.text}`}
                    style={customText}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
