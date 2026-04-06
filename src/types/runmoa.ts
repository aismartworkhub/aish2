/** Runmoa 콘텐츠 API 타입 정의 */

export type RunmoaContentType = "vod" | "live" | "offline" | "digital_content";

export type RunmoaStatus =
  | "publish"
  | "pending"
  | "paused"
  | "in_review"
  | "banned";

export interface RunmoaCategory {
  category_id: number;
  parent_category_id: number;
  name: string;
  description: string;
  path: string;
}

export interface RunmoaContentOption {
  option_id: number;
  title: string;
  description: string;
  base_price: number;
  sale_price: number;
  is_on_sale: boolean;
  is_free: boolean;
  capacity: number;
  sold_count: number;
  status: string;
  start_at: string | null;
  end_at: string | null;
  access_url: string | null;
  location_text: string | null;
  location_detail: string | null;
}

export interface RunmoaContent {
  content_id: number;
  title: string;
  description_html: string;
  content_type: RunmoaContentType;
  status: RunmoaStatus;
  language: string;
  category_ids: number[];
  categories: RunmoaCategory[];
  featured_image: string;
  images: string[];
  thumbnail_link: string | null;
  base_price: number;
  sale_price: number;
  is_on_sale: boolean;
  is_free: boolean;
  options: RunmoaContentOption[];
  created_at: string;
  updated_at: string;
}

export interface RunmoaPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number;
  to: number;
  has_more_pages: boolean;
}

export interface RunmoaContentsResponse {
  data: RunmoaContent[];
  pagination: RunmoaPagination;
}

export interface RunmoaContentsParams {
  page?: number;
  limit?: number;
  status?: RunmoaStatus;
  content_type?: RunmoaContentType;
  category_id?: number;
  search?: string;
}
