import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { isOwnerEmail } from '@/lib/owner';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!isOwnerEmail(data.user?.email)) throw redirect({ to: '/auth' });
  },
  component: Outlet,
});