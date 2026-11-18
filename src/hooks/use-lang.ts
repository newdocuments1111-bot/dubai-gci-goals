import { useCallback, useEffect, useState } from "react";
import { LANG_KEY, dirOf, isLang, tr, type Lang } from "@/lib/i18n";

/** The person's app language, remembered on this device. Sets the page direction for Arabic. */
export function useLang() {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (isLang(saved)) setLangState(saved);
    } catch {
      /* storage can be blocked; English stays */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* not remembered, still applied */
    }
  }, []);
  const t = useCallback((text: string) => tr(lang, text), [lang]);
  return { lang, setLang, t };
}
