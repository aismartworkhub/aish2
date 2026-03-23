"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getCollection } from "@/lib/firestore";

interface UseFirestoreCollectionResult<T> {
  data: T[];
  setData: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Firestore 컬렉션 SWR 훅
 * - 캐시 히트 시 즉시 반환 (loading → false가 거의 즉시)
 * - 캐시 미스 시 네트워크 fetch 후 반환
 * - error 상태로 에러 메시지 노출
 */
export function useFirestoreCollection<T>(
  collectionName: string,
  sortFn?: (a: T, b: T) => number,
): UseFirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sortRef = useRef(sortFn);
  sortRef.current = sortFn;

  const fetchData = useCallback(async (isBackground = false) => {
    try {
      setError(null);
      const result = await getCollection<T>(collectionName);
      const sorted = sortRef.current ? result.sort(sortRef.current) : result;
      setData(sorted);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.";
      if (!isBackground) setError(msg);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [collectionName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, setData, loading, error, refresh: () => fetchData(false) };
}
