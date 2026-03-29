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

const DISMISSED_KEY = "aish_dismissed_banners";

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch { /* noop */ }
}

function isExternal(href: string) {
  return /^https?:\/\//.test(href);
}

export default function QuickBannerDisplay() {
  const currentPath = usePathname() || "/";
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [banners, setBanners] = useState<QuickBannerDemo[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(getDismissed());
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

  const visibleBanners = activeBanners.slice(0, 1);

  const handleDismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    persistDismissed(next);
  };

  return (
    <div>
      {visibleBanners.map((banner) => {
        const colors = STYLE_COLORS[banner.style] || STYLE_COLORS.INFO;
        const customBg = banner.backgroundColor
          ? { backgroundColor: banner.backgroundColor }
          : undefined;
        const customText = banner.textColor ? { color: banner.textColor } : undefined;

        const linkHref = banner.ctaLink?.trim() || "#";
        const hasLink = linkHref !== "#";
        const external = hasLink && isExternal(linkHref);

        return (
          <div
            key={banner.id}
            role="banner"
            className={`${customBg ? "" : colors.bg} border-b ${colors.border} px-4 py-0`}
            style={customBg}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 min-h-[44px]">
              {/* 제목+설명 영역 전체가 링크 */}
              {hasLink ? (
                <Link
                  href={linkHref}
                  target={external || banner.ctaOpenNewTab ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className={`flex-1 min-w-0 py-2.5 text-sm font-medium hover:underline ${customText ? "" : colors.text}`}
                  style={customText}
                >
                  <span className="font-bold">{banner.title}</span>
                  {banner.description && banner.description !== banner.title && (
                    <span className="ml-2 font-normal opacity-80">{banner.description}</span>
                  )}
                </Link>
              ) : (
                <p
                  className={`flex-1 min-w-0 py-2.5 text-sm font-medium ${customText ? "" : colors.text}`}
                  style={customText}
                >
                  <span className="font-bold">{banner.title}</span>
                  {banner.description && banner.description !== banner.title && (
                    <span className="ml-2 font-normal opacity-80">{banner.description}</span>
                  )}
                </p>
              )}

              <div className="flex items-center gap-3 shrink-0">
                {/* CTA 텍스트: 제목과 다를 때만 별도 표시 */}
                {banner.ctaText && hasLink && banner.ctaText !== banner.title && (
                  <Link
                    href={linkHref}
                    target={external || banner.ctaOpenNewTab ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className={`text-sm font-semibold underline whitespace-nowrap ${customText ? "" : colors.text}`}
                    style={customText}
                  >
                    {banner.ctaText}
                  </Link>
                )}
                {banner.isDismissible && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDismiss(banner.id);
                    }}
                    className={`p-2.5 -mr-1 rounded-lg hover:bg-black/10 transition-colors ${customText ? "" : colors.text}`}
                    style={customText}
                    aria-label="닫기"
                  >
                    <X size={18} />
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
