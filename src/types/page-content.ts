/** 페이지별 콘텐츠 관리 타입 */

export interface PageHero {
  imageUrl: string;
  title: string;
  subtitle: string;
}

export interface PageSection {
  title: string;
  description?: string;
}

export interface ValueItem {
  icon: string;
  title: string;
  desc: string;
}

export interface EducationCard {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  span?: "big" | "normal";
}

export interface SpecialtyCard {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
}

export interface PageContentBase {
  hero: PageHero;
  sections: Record<string, PageSection>;
}

export interface HomePageContent extends PageContentBase {
  educationCards: EducationCard[];
  specialtyCards: SpecialtyCard[];
}

export interface AboutPageContent extends PageContentBase {
  values: ValueItem[];
}

export type PageKey =
  | "home"
  | "about"
  | "programs"
  | "instructors"
  | "workathon"
  | "videos"
  | "media"
  | "community";
