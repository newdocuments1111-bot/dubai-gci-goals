import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Signed-in user's email (null if signed out), and whether it has loaded. */
export function useSessionEmail() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setEmail(data.user?.email ?? null); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { email, ready };
}
