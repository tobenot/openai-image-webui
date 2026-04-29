import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { readJson, writeJson } from "../lib/storage";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readJson<T>(key) ?? initialValue);

  useEffect(() => {
    writeJson(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
