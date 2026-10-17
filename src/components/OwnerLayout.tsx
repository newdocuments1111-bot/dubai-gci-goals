import { Link, useRouterState } from '@tanstack/react-router';
import { Outlet } from '@tanstack/react-router';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/test-chat', label: 'Test Chat' },
  { to: '/leads', label: 'Leads' },
  { to: '/viewings', label: 'Viewings' },
  { to: '/follow-ups', label: 'Follow-ups' },
  { to: '/stats', label: 'Statistics' },
  { to: '/listings', label: 'My Listings' },
  { to: '/owners', label: 'Owners' },
  { to: '/market-data', label: 'Market Data' },
  { to: '/uae-knowledge', label: 'UAE Knowledge' },
  { to: '/ai-reply-rules', label: 'AI Reply Rules' },
  { to: '/settings', label: 'Settings' },
  { to: '/', label: 'Calculator' },
] as const;

export function OwnerLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav aria-label="Owner pages" className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-3 py-2">
          <span className="mr-2 shrink-0 text-sm font-bold">Dubai AI GCI</span>
          {NAV.map(item => (
            <Link key={item.to} to={item.to}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm ${pathname === item.to ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="flex-1"><Outlet /></div>
      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">Powered by Elite Visions</footer>
    </div>
  );
}
