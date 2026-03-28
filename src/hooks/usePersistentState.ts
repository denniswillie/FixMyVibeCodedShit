import { useEffect, useState } from "react";

const readValue = <T,>(key: string, initialValue: T | (() => T)) => {
  const fallback =
    typeof initialValue === "function"
      ? (initialValue as () => T)()
      : initialValue;

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const usePersistentState = <T,>(
  key: string,
  initialValue: T | (() => T)
) => {
  const [value, setValue] = useState<T>(() => readValue(key, initialValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  }, [key, value]);

  return [value, setValue] as const;
};
