import { useState, useEffect } from "react";

const DEFAULT_DELAY = 300;

export function useDebounce<T>(value: T, delay: number = DEFAULT_DELAY): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
