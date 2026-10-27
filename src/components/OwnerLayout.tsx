import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { Outlet } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMembership } from '@/hooks/use-membership';

type NavItem = { to: string; label: string; show?: 'owner' | 'hq' | 'manager' };
const NAV: readonly NavItem[] = [
  { to: '/dashboard', label: 'Home' },
  { to: '/test-chat', label: 'Test Chat' },
  { to: '/leads', label: 'Leads' },
  { to: '/deals', label: 'Deals' },
  { to: '/viewings', label: 'Viewings' },
  { to: '/follow-ups', label: 'Follow-ups' },
  { to: '/stats', label: 'Statistics', show: 'owner' },
  { to: '/listings', label: 'My Listings' },
  { to: '/owners', label: 'Owners' },
  { to: '/market-insights', label: 'Market Insights' },
  { to: '/market-data', label: 'Market Data' },
  { to: '/uae-knowledge', label: 'UAE Knowledge' },
  { to: '/team', label: 'Team', show: 'owner' },
  { to: '/ai-reply-rules', label: 'AI Reply Rules', show: 'owner' },
  { to: '/settings', label: 'Settings' },
  { to: '/settings/whatsapp', label: 'WhatsApp', show: 'owner' },
  { to: '/templates', label: 'Templates', show: 'manager' },
  { to: '/queue', label: 'Send queue' },
  { to: '/hq', label: 'Elite Visions HQ', show: 'hq' },
  { to: '/', label: 'Calculator' },
];

export function OwnerLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const membership = useMembership();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const items = NAV.filter(i => !i.show || (i.show === 'owner' ? membership.isOwner : i.show === 'manager' ? membership.isOwner || membership.isHq : membership.isHq));
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: '/auth', replace: true });
  };
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav aria-label="App pages" className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2">
          <span className="mr-2 shrink-0 text-sm font-bold">Dubai AI GCI</span>
          <span className="mr-2 shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground" title="Your agency and role">{membership.agencyName} · {membership.isOwner ? 'Owner' : 'Agent'}</span>
          {items.map(item => (
            <Link key={item.to} to={item.to}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm ${pathname === item.to ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {item.label}
            </Link>
          ))}
          <button type="button" onClick={() => void signOut()} className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="size-4" />Sign out
          </button>
        </div>
      </nav>
      <div className="flex-1"><Outlet /></div>
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">Powered by Elite Visions</footer>
    </div>
  );
}
