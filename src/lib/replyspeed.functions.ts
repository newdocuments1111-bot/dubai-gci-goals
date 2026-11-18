import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccess } from "./agency-access";
import {
  DEFAULT_PERIOD_DAYS,
  agentReplyRows,
  waitingLeads,
  type AgentReplyRow,
  type ReplyDeal,
  type ReplyLead,
  type WaitingLead,
} from "./replyspeed";

const PAGE = 1000;
const MAX_LEADS = 20_000;
const MAX_WAITING = 50;

export type ReplySpeed = {
  periodDays: number;
  /** "agency" = owner or HQ (every agent), "team" = a team leader, "self" = own row only. */
  scope: "agency" | "team" | "self";
  rows: (AgentReplyRow & { isMe: boolean })[];
  waiting: (WaitingLead & { agentName: string })[];
  waitingTotal: number;
  /** True when the period holds more leads than were read, so the numbers are incomplete. */
  truncated: boolean;
};

/** Read-only. Owner and HQ see every agent of the agency, a team leader their agents, an agent only themselves. */
export const getReplySpeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReplySpeed> => {
    const access = await getAccess(context.supabase, context.userId);
    const now = new Date();
    const since = new Date(now.getTime() - DEFAULT_PERIOD_DAYS * 86_400_000).toISOString();

    const { data: members, error: membersError } = await context.supabase
      .from("agency_members")
      .select("user_id,display_name,email,team_leader_id")
      .eq("agency_id", access.agencyId)
      .in("role", ["owner", "agent"]);
    if (membersError) throw new Error("Could not load reply speed.");

    const all = access.isOwner || access.isHq;
    const seen = new Set<string>();
    const visible = (members ?? []).filter((m) => {
      if (seen.has(m.user_id)) return false;
      if (!all && m.user_id !== context.userId && m.team_leader_id !== context.userId) return false;
      seen.add(m.user_id);
      return true;
    });
    const ids = visible.map((m) => m.user_id);
    const agents = visible.map((m) => ({
      user_id: m.user_id,
      name: m.display_name || m.email || "Agent",
    }));
    const scope = all ? "agency" : ids.some((id) => id !== context.userId) ? "team" : "self";
    if (ids.length === 0)
      return {
        periodDays: DEFAULT_PERIOD_DAYS,
        scope,
        rows: [],
        waiting: [],
        waitingTotal: 0,
        truncated: false,
      };

    // Imported leads are old records, not new enquiries, so they are never counted as waiting or missed.
    const leads: ReplyLead[] = [];
    let truncated = false;
    for (let from = 0; ; from += PAGE) {
      if (from >= MAX_LEADS) {
        truncated = true;
        break;
      }
      let query = context.supabase
        .from("leads")
        .select("id,name,source,created_at,first_reply_at,assigned_agent_id,outcome")
        .eq("agency_id", access.agencyId)
        .neq("intake", "import")
        .gte("created_at", since);
      // Owner and HQ also see unassigned leads in the waiting list; everyone else only their agents' leads.
      if (!all) query = query.in("assigned_agent_id", ids);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error("Could not load reply speed.");
      leads.push(...(data ?? []));
      if ((data ?? []).length < PAGE) break;
    }

    const { data: dealRows, error: dealsError } = await context.supabase
      .from("deals")
      .select("agent_id,status,closed_at")
      .eq("agency_id", access.agencyId)
      .eq("status", "closed")
      .not("closed_at", "is", null)
      .in("agent_id", ids)
      .order("closed_at", { ascending: false })
      .limit(PAGE);
    if (dealsError) throw new Error("Could not load reply speed.");
    const deals: ReplyDeal[] = dealRows ?? [];

    const names = new Map(agents.map((a) => [a.user_id, a.name]));
    const waiting = waitingLeads(
      leads.filter((l) => l.assigned_agent_id === null || names.has(l.assigned_agent_id)),
      now,
    );
    return {
      periodDays: DEFAULT_PERIOD_DAYS,
      scope,
      rows: agentReplyRows(agents, leads, deals, now, DEFAULT_PERIOD_DAYS).map((r) => ({
        ...r,
        isMe: r.userId === context.userId,
      })),
      waiting: waiting.slice(0, MAX_WAITING).map((w) => ({
        ...w,
        agentName: w.agentId ? (names.get(w.agentId) ?? "Agent") : "Unassigned",
      })),
      waitingTotal: waiting.length,
      truncated,
    };
  });
