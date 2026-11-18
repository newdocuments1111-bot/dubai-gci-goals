import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ComponentType } from "react";
import {
  Building2,
  Calculator,
  CalendarCheck,
  Handshake,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMembership } from "@/hooks/use-membership";
import { createLead, listLeads } from "@/lib/leads-app.functions";
import { timezoneFromPhone } from "@/lib/leads-app";
import { LEAD_SOURCES } from "@/lib/inbox";
import {
  activePage,
  searchablePages,
  sectionFor,
  visibleSections,
  type NavSection,
  type NavSectionId,
} from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { AlertsBell } from "@/components/AlertsBell";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const ICONS: Record<NavSectionId, ComponentType<{ className?: string }>> = {
  today: CalendarCheck,
  leads: Users,
  deals: Handshake,
  listings: Building2,
  insights: TrendingUp,
  settings: Settings,
  tools: Calculator,
};

const SOURCES = LEAD_SOURCES;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

/** Private app shell: five-section sidebar, section tabs, Ctrl+K search and one "New lead" button. */
export function OwnerLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const membership = useMembership();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sections = visibleSections(membership);
  const current = sectionFor(pathname);
  const currentSection =
    [...sections.main, sections.settings, sections.tools].find((s) => s?.id === current) ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <p className="text-[15px] font-semibold tracking-tight">Dubai AI GCI</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{membership.agencyName}</p>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 px-2">
        {sections.main.map((s) => (
          <SideLink key={s.id} section={s} active={current === s.id} />
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-border px-2 py-2">
        {sections.tools?.pages.map((p) => {
          const Icon = p.to === "/hq" ? ShieldCheck : Calculator;
          return (
            <Link
              key={p.to}
              to={p.to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${pathname === p.to ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
            >
              <Icon className="size-4" />
              {p.label}
            </Link>
          );
        })}
        {sections.settings && (
          <SideLink section={sections.settings} active={current === "settings"} />
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-border px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(membership.displayName || membership.agencyName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{membership.displayName || "You"}</p>
          <p className="text-xs text-muted-foreground">
            {membership.isOwner ? "Owner" : "Agent"}
            {membership.isHq ? " · HQ" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-border bg-muted/40 lg:block">
        {sidebar}
      </aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen flex-col lg:pl-60">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-6">
            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <p className="truncate text-base font-semibold">
              {currentSection?.label ?? activePage(pathname)?.label ?? ""}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <AlertsBell />
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:text-foreground sm:w-64"
              >
                <Search className="size-4" />
                <span className="hidden sm:inline">Search leads, pages…</span>
                <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 text-[10px] font-medium sm:inline">
                  Ctrl K
                </kbd>
              </button>
              <Button size="sm" className="h-9" onClick={() => setNewLeadOpen(true)}>
                <Plus className="size-4" />
                <span className="hidden sm:inline">New lead</span>
              </Button>
            </div>
          </div>
          {currentSection && currentSection.pages.length > 1 && (
            <nav
              aria-label={`${currentSection.label} pages`}
              className="flex gap-1 overflow-x-auto px-3 sm:px-6"
            >
              {currentSection.pages.map((p) => {
                const on = activePage(pathname)?.to === p.to;
                return (
                  <Link
                    key={p.to}
                    to={p.to}
                    className={`shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-sm ${on ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </header>

        <div className="flex-1">
          <Outlet />
        </div>
        <footer className="py-4 text-center text-xs text-muted-foreground">
          Powered by Elite Visions
        </footer>
      </div>

      <SearchMenu
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNewLead={() => setNewLeadOpen(true)}
      />
      {newLeadOpen && <NewLeadDialog onClose={() => setNewLeadOpen(false)} />}
    </div>
  );
}

function SideLink({ section, active }: { section: NavSection; active: boolean }) {
  const Icon = ICONS[section.id];
  const first = section.pages[0];
  if (!first) return null;
  return (
    <Link
      to={first.to}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
    >
      <Icon className="size-4" />
      {section.label}
    </Link>
  );
}

function SearchMenu({
  open,
  onOpenChange,
  onNewLead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewLead: () => void;
}) {
  const membership = useMembership();
  const navigate = useNavigate();
  const leads = useQuery({ queryKey: ["leads"], queryFn: () => listLeads(), enabled: open });
  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search a lead by name, phone or area, or a page…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onNewLead();
            }}
          >
            <Plus className="size-4" />
            New lead
          </CommandItem>
        </CommandGroup>
        {(leads.data ?? []).length > 0 && (
          <CommandGroup heading="Leads">
            {(leads.data ?? []).slice(0, 200).map((l) => (
              <CommandItem
                key={l.id}
                value={`${l.name ?? ""} ${l.phone ?? ""} ${l.area ?? ""} ${l.id}`}
                onSelect={() => {
                  onOpenChange(false);
                  navigate({ to: "/lead/$leadId", params: { leadId: l.id } });
                }}
              >
                <Users className="size-4" />
                <span className="flex-1 truncate">{l.name || "Unnamed lead"}</span>
                <span className="text-xs text-muted-foreground">
                  {[l.score, l.area].filter(Boolean).join(" · ")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Pages">
          {searchablePages(membership).map((p) => (
            <CommandItem key={p.to} value={`page ${p.title}`} onSelect={() => go(p.to)}>
              {p.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function NewLeadDialog({ onClose }: { onClose: () => void }) {
  const create = useServerFn(createLead);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("Other");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const lead = await create({
        data: { name, phone, type: "buyer", source, timezone: timezoneFromPhone(phone) },
      });
      client.invalidateQueries({ queryKey: ["leads"] });
      client.invalidateQueries({ queryKey: ["pipeline"] });
      onClose();
      navigate({ to: "/lead/$leadId", params: { leadId: lead.id } });
    } catch {
      setError("Could not create the lead.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>New lead</DialogTitle>
        <DialogDescription>
          Add the name and phone. You can fill in the rest on the lead.
        </DialogDescription>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="text-sm">
            Name
            <Input
              className="mt-1"
              autoFocus
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Phone (with country code)
            <Input
              className="mt-1"
              maxLength={50}
              placeholder="+971…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Came from
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={source}
              onChange={(e) => setSource(e.target.value as (typeof SOURCES)[number])}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Create lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
