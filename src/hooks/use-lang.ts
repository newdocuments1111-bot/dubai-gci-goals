import { useCallback, useEffect, useSyncExternalStore } from "react";
import { LANG_KEY, dirOf, isLang, trf, type Lang } from "@/lib/i18n";

// One language for the whole app: the menu and every page read the same value and change together.
let current: Lang = "en";
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (isLang(saved)) current = saved;
  } catch {
    /* storage can be blocked; English stays */
  }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/** The person's app language, remembered on this device. Sets the page direction for Arabic. */
export function useLang() {
  // The first paint is English (same as the server), then the saved language is applied.
  const lang = useSyncExternalStore(
    subscribe,
    () => current,
    () => "en" as Lang,
  );
  useEffect(() => {
    if (loaded) return;
    load();
    listeners.forEach((fn) => fn());
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);
  const setLang = useCallback((next: Lang) => {
    current = next;
    loaded = true;
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* not remembered, still applied */
    }
    listeners.forEach((fn) => fn());
  }, []);
  const t = useCallback(
    (text: string, vars?: Record<string, string | number>) => trf(lang, text, vars),
    [lang],
  );
  return { lang, setLang, t };
}
