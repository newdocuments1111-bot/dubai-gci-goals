import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { scoreFromSigns, type Lead } from "./leads";

const HUBSPOT_VERSION = "2026-09";
const GATEWAY = "https://connector-gateway.lovable.dev/hubspot";
const hs = {
  contacts: () => `/crm/objects/${HUBSPOT_VERSION}/contacts`,
  notesBatchRead: () => `/crm/objects/${HUBSPOT_VERSION}/notes/batch/read`,
};

function keys() {
  const lovable = process.env['LOVABLE_API_KEY'];
  const hubspot = process.env['HUBSPOT_API_KEY'];
  if (!lovable) throw new Error("AI is not configured.");
  if (!hubspot) throw new Error("HubSpot is not connected yet.");
  return { lovable, hubspot };
}

async function hubspot(path: string, init: RequestInit = {}) {
  const { lovable, hubspot } = keys();
  const res = await fetch(GATEWAY + path, {
    ...init,
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": hubspot, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`HubSpot request failed [${res.status}]: ${body}`);
    throw new Error(`HubSpot request failed (${res.status}).`);
  }
  return res.json();
}

type Contact = { id: string; properties: Record<string, string | null>; url?: string; associations?: { notes?: { results: { id: string }[] } } };

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const INSTRUCTIONS = `You review real estate leads in Dubai for an agent. For each lead, read ONLY the given text and check 3 signs:
- budget: any amount or price range mentioned
- location: any area, community or project mentioned
- moveIn: when they want to buy or move in
Rules: be honest. Never invent details not in the text. If a sign is not clearly mentioned, mark it missing (null). Never promise profit, returns or guaranteed outcomes.
For each lead give one short, practical next step (max 20 words) focused on the missing signs.
Reply with JSON only: {"leads":[{"id":"...","budget":"quote or null","location":"quote or null","moveIn":"quote or null","nextStep":"..."}]}`;

export async function loadLeads(): Promise<Lead[]> {
  const { lovable } = keys();
  const list = await hubspot(`${hs.contacts()}?limit=50&associations=notes&properties=firstname,lastname,email,phone,message`);
  const contacts: Contact[] = list.results ?? [];
  if (!contacts.length) return [];

  const noteIds = [...new Set(contacts.flatMap((c) => c.associations?.notes?.results.map((n) => n.id) ?? []))];
  const notes = new Map<string, string>();
  for (let i = 0; i < noteIds.length; i += 100) {
    const r = await hubspot(hs.notesBatchRead(), {
      method: "POST",
      body: JSON.stringify({ properties: ["hs_note_body"], inputs: noteIds.slice(i, i + 100).map((id) => ({ id })) }),
    });
    for (const n of r.results ?? []) notes.set(n.id, strip(n.properties?.hs_note_body ?? ""));
  }

  const items = contacts.map((c) => {
    const p = c.properties;
    const name = [p['firstname'], p['lastname']].filter(Boolean).join(" ") || p['email'] || "Unnamed contact";
    const text = [p['message'], ...(c.associations?.notes?.results.map((n) => notes.get(n.id)) ?? [])].filter(Boolean).join("\n").slice(0, 3000);
    return { id: c.id, name, email: p['email'] ?? null, url: c.url ?? null, text };
  });

  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: lovable,
    headers: { "Lovable-API-Key": lovable, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: INSTRUCTIONS,
    messages: [{ role: "user", content: JSON.stringify(items.map(({ id, text }) => ({ id, text: text || "(no notes)" }))) }],
    providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] } },
  });
  let raw = "";
  try {
    raw = await result.text;
  } catch (e) {
    console.error(e);
    const status = (e as { statusCode?: number }).statusCode;
    throw new Error(status === 402 ? "AI credits have run out. Add credits in Settings → Plans & credits." : status === 429 ? "AI is busy. Please try again in a minute." : "AI could not read the leads.");
  }
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed: { leads: { id: string; budget: string | null; location: string | null; moveIn: string | null; nextStep: string }[] } = match ? JSON.parse(match[0]) : { leads: [] };
  const byId = new Map(parsed.leads.map((l) => [String(l.id), l]));

  const order = { hot: 0, warm: 1, cold: 2 };
  return items
    .map((it) => {
      const a = byId.get(it.id);
      const signs = { budget: a?.budget || null, location: a?.location || null, moveIn: a?.moveIn || null };
      return { id: it.id, name: it.name, email: it.email, url: it.url, signs, score: scoreFromSigns(signs), nextStep: a?.nextStep || "Call to ask about budget, area and timing." };
    })
    .sort((x, y) => order[x.score] - order[y.score]);
}
