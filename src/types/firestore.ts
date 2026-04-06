export interface HeroSlide {
  id?: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  isActive: boolean;
  displayOrder: number;
}

export interface Program {
  id?: string;
  title: string;
  category: string;
  status: string;
  cohort: string;
  summary: string;
  schedule: string;
  startDate: string;
  endDate: string;
  instructors: string[];
  thumbnailUrl: string;
  /** 카드 하단 CTA 버튼 문구 (비우면 공통 기본 문구 사용) */
  ctaText?: string;
  /** 카드 하단 CTA 링크 — 외부(https://) 또는 사이트 내 경로(/path). 비우면 버튼 미표시 */
  ctaLink?: string;
}

export interface DriveAttachment {
  name: string;
  url: string;
  size: string;
  type: string;
  driveFileId?: string;
  driveDownloadUrl?: string;
  driveViewUrl?: string;
}

export interface Instructor {
  id?: string;
  name: string;
  title: string;
  organization: string;
  profileImageUrl: string;
  specialties: string[];
  bio: string;
  socialLinks: {
    linkedin: string | null;
    youtube: string | null;
    instagram: string | null;
    github: string | null;
    personalSite: string | null;
  };
  programs: string[];
}

export interface Post {
  id?: string;
  title: string;
  content: string;
  type: "NOTICE" | "RESOURCE";
  isPinned: boolean;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoItem {
  id?: string;
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  category: string;
  isFeatured: boolean;
  publishedAt: string;
}

export interface Review {
  id?: string;
  authorName: string;
  authorCohort: string;
  content: string;
  rating: number;
  programTitle: string;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export interface FAQItem {
  id?: string;
  question: string;
  answer: string;
  category: string;
  displayOrder: number;
}

export interface Inquiry {
  id?: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  type: string;
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  memo: string;
  createdAt: string;
}

export interface QuickBanner {
  id?: string;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  ctaOpenNewTab: boolean;
  style: "INFO" | "PROMOTION" | "WARNING" | "EVENT";
  position: "TOP" | "BOTTOM" | "MODAL";
  backgroundColor: string | null;
  textColor: string | null;
  targetPages: string[];
  isDismissible: boolean;
  isActive: boolean;
  startDate: string;
  endDate: string;
  displayOrder: number;
}

export interface WorkathonEvent {
  id?: string;
  title: string;
  edition: number;
  eventDate: string;
  venue: string;
  status: string;
  description: string;
  maxParticipants: number;
  currentParticipantCount: number;
  posterUrl?: string;
  schedule: { time: string; title: string; speaker: string | null }[];
}

export interface Resource {
  id?: string;
  title: string;
  description: string;
  content?: string;
  author?: string;
  fileType: string;
  fileName: string;
  fileSize: string;
  driveFileId: string;
  driveDownloadUrl: string;
  driveViewUrl: string;
  uploaderId: string;
  uploaderName: string;
  uploaderEmail: string;
  downloads: number;
  tags: string[];
}

export interface AdminEvent {
  id?: string;
  title: string;
  tags: string[];
  startDate: string;
  endDate: string;
  status: string;
  organizer: string;
  contactPerson: string;
  phone: string;
  email: string;
  summary: string;
  thumbnailUrl: string;
}
