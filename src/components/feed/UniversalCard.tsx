"use client";

import Link from "next/link";
import { GraduationCap, Calendar, User, MapPin, ChevronRight, Pin } from "lucide-react";
import type { FeedItem } from "@/types/feed";
import type { Content } from "@/types/content";
import { ContentCard, type ContentCardVariant } from "@/components/content";

interface UniversalCardProps {
  item: FeedItem;
  /** Content 카드용 variant (기본 dispatch). 다른 kind는 자체 카드 사용. */
  variant?: ContentCardVariant;
  onClickContent?: (c: Content) => void;
  priority?: boolean;
}

export default function UniversalCard({ item, variant = "dispatch", onClickContent, priority }: UniversalCardProps) {
  if (item.kind === "content") {
    return (
      <ContentCard
        content={item.data}
        variant={variant}
        onClick={onClickContent}
        priority={priority}
      />
    );
  }
  if (item.kind === "program") return <ProgramFeedCard data={item.data} pinned={item.pinned} />;
  if (item.kind === "event") return <EventFeedCard data={item.data} pinned={item.pinned} />;
  return <InstructorFeedCard data={item.data} />;
}

/* ── 프로그램 카드 ──────────────────────────────────────────── */

function ProgramFeedCard({ data, pinned }: { data: FeedItem extends { kind: "program"; data: infer T } ? T : never; pinned?: boolean }) {
  const href = data.ctaLink || "/programs";
  const isExternal = href.startsWith("http");
  return (
    <CardLink href={href} external={isExternal}>
      <div className="flex w-full gap-3 border-b border-gray-100 bg-white p-3 transition-colors hover:bg-emerald-50/40">
        {/* 썸네일 */}
        <div className="relative shrink-0 w-24 sm:w-36 aspect-video overflow-hidden rounded-md bg-emerald-50">
          {data.thumbnailUrl ? (
            <img src={data.thumbnailUrl} alt={data.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <GraduationCap size={24} className="text-emerald-400" />
            </div>
          )}
          <span className="absolute top-1 left-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            🎓 프로그램
          </span>
          {pinned && (
            <span className="absolute top-1 right-1 rounded-full bg-rose-500 p-0.5 text-white">
              <Pin size={10} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col">
          <h3 className="line-clamp-2 text-sm font-bold text-gray-900 leading-snug">
            {data.title}
          </h3>
          {data.summary && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-600 leading-relaxed">
              {data.summary}
            </p>
          )}
          <div className="mt-auto pt-1.5 flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
              {data.cohort || data.category}
            </span>
            {data.startDate && (
              <span className="text-gray-400">{data.startDate} ~ {data.endDate || "미정"}</span>
            )}
          </div>
        </div>
        <ChevronRight size={14} className="self-center shrink-0 text-gray-300" />
      </div>
    </CardLink>
  );
}

/* ── 이벤트 카드 ──────────────────────────────────────────── */

function EventFeedCard({ data, pinned }: { data: FeedItem extends { kind: "event"; data: infer T } ? T : never; pinned?: boolean }) {
  return (
    <CardLink href="/event">
      <div className="flex w-full gap-3 border-b border-gray-100 bg-white p-3 transition-colors hover:bg-amber-50/40">
        <div className="relative shrink-0 w-24 sm:w-36 aspect-video overflow-hidden rounded-md bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
          <Calendar size={28} className="text-amber-500" />
          <span className="absolute top-1 left-1 rounded bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            📅 이벤트
          </span>
          {pinned && (
            <span className="absolute top-1 right-1 rounded-full bg-rose-500 p-0.5 text-white">
              <Pin size={10} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col">
          <h3 className="line-clamp-2 text-sm font-bold text-gray-900 leading-snug">
            {data.title}
          </h3>
          <div className="mt-auto pt-1.5 flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
            {data.startDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                {data.startDate} ~ {data.endDate || "미정"}
              </span>
            )}
            {data.organizer && <span className="text-gray-400">{data.organizer}</span>}
            {data.location && (
              <span className="inline-flex items-center gap-0.5 text-gray-400">
                <MapPin size={10} />{data.location}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={14} className="self-center shrink-0 text-gray-300" />
      </div>
    </CardLink>
  );
}

/* ── 강사 카드 ──────────────────────────────────────────── */

function InstructorFeedCard({ data }: { data: FeedItem extends { kind: "instructor"; data: infer T } ? T : never }) {
  return (
    <CardLink href="/instructors">
      <div className="flex w-full gap-3 border-b border-gray-100 bg-white p-3 transition-colors hover:bg-violet-50/40">
        <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 overflow-hidden rounded-full bg-violet-100">
          {data.profileImageUrl || data.imageUrl ? (
            <img
              src={data.profileImageUrl || data.imageUrl}
              alt={data.name}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User size={28} className="text-violet-400" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">👤 강사</span>
          </div>
          <h3 className="mt-1 text-sm font-bold text-gray-900 truncate">{data.name}</h3>
          {data.title && (
            <p className="text-xs text-gray-600 truncate">{data.title}{data.organization ? ` · ${data.organization}` : ""}</p>
          )}
          {data.specialties && data.specialties.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {data.specialties.slice(0, 3).map((s) => (
                <span key={s} className="rounded-full bg-violet-50 text-violet-700 px-1.5 py-0.5 text-[10px]">
                  #{s}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight size={14} className="self-center shrink-0 text-gray-300" />
      </div>
    </CardLink>
  );
}

/* ── 공용 링크 래퍼 ─────────────────────────────────────────── */

function CardLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block w-full">
        {children}
      </a>
    );
  }
  return <Link href={href} className="block w-full">{children}</Link>;
}

