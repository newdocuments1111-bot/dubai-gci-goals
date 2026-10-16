import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { isOwnerEmail } from '@/lib/owner';
import { OwnerLayout } from '@/components/OwnerLayout';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!isOwnerEmail(data.user?.email)) throw redirect({ to: '/auth' });
  },
  component: OwnerLayout,
});
