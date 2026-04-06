"use client";

import { useState, useEffect, useCallback } from "react";
import { getRunmoaContents, invalidateRunmoaCache } from "@/lib/runmoa-api";
import type {
  RunmoaContent,
  RunmoaContentsParams,
  RunmoaPagination,
} from "@/types/runmoa";

interface UseRunmoaContentsResult {
  data: RunmoaContent[];
  pagination: RunmoaPagination | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const EMPTY_PAGINATION: RunmoaPagination = {
  current_page: 1,
  per_page: 20,
  total: 0,
  last_page: 1,
  from: 0,
  to: 0,
  has_more_pages: false,
};

export function useRunmoaContents(
  params: RunmoaContentsParams = {}
): UseRunmoaContentsResult {
  const [data, setData] = useState<RunmoaContent[]>([]);
  const [pagination, setPagination] = useState<RunmoaPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 파라미터를 JSON 문자열로 직렬화하여 deps로 사용
  const paramKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRunmoaContents(params);
      setData(res.data);
      setPagination(res.pagination);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "콘텐츠를 불러오지 못했습니다.";
      setError(msg);
      setData([]);
      setPagination(EMPTY_PAGINATION);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    invalidateRunmoaCache();
    fetchData();
  }, [fetchData]);

  return { data, pagination, loading, error, refresh };
}
