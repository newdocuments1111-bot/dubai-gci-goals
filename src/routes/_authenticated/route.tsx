import { createFileRoute, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { getAccess } from '@/lib/agency-access';
import { OwnerLayout } from '@/components/OwnerLayout';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: '/auth' });
    // Cosmetic gate only: every server action re-checks agency access and the database enforces it.
    const membership = await getAccess(supabase, data.user.id).catch(() => null);
    if (!membership) throw redirect({ to: '/onboarding' });
    return { membership };
  },
  component: OwnerLayout,
});
