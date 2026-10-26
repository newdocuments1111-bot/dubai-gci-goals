import { useRouteContext } from '@tanstack/react-router';
import type { Membership } from '@/lib/agency';

/** The signed-in person's agency and role, loaded once by the private layout. */
export function useMembership(): Membership {
  return useRouteContext({ from: '/_authenticated', select: c => c.membership });
}
