import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const GATEWAY = 'https://connector-gateway.lovable.dev/hubspot';
const HS_VERSION = '2026-09';

export function gatewayKeys() {
  const lovable = process.env['LOVABLE_API_KEY'];
  if (!lovable) throw new Error('AI is not configured.');
  return lovable;
}

export function aiModel() {
  const lovable = gatewayKeys();
  const provider = createOpenAI({
    baseURL: 'https://ai.gateway.lovable.dev/v1',
    apiKey: lovable,
    headers: { 'Lovable-API-Key': lovable, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
  });
  return provider.responses('openai/gpt-6-astra');
}

export async function generateJson(prompt: { system: string; user: string }) {
  const result = await generateText({
    model: aiModel(),
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: 'low', include: ['reasoning.encrypted_content'] } },
  });
  const match = result.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI returned an unreadable answer.');
  return JSON.parse(match[0]) as Record<string, unknown>;
}

async function hubspotFetch(path: string, init: RequestInit = {}) {
  const lovable = gatewayKeys();
  const hubspot = process.env['HUBSPOT_API_KEY'];
  if (!hubspot) throw new Error('HubSpot is not connected yet.');
  const res = await fetch(GATEWAY + path, {
    ...init,
    headers: { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': hubspot, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`HubSpot request failed [${res.status}]: ${body}`);
    throw new Error(`HubSpot request failed (${res.status}).`);
  }
  return res.json();
}

/** Create or update a HubSpot contact and attach a note. Returns the contact id. */
export async function saveContactToHubSpot(input: { name: string; phone: string; note: string; existingId?: string | null }) {
  const [firstname, ...rest] = input.name.trim().split(/\s+/);
  const properties = { firstname: firstname || input.name, lastname: rest.join(' '), phone: input.phone };
  let id = input.existingId ?? null;
  if (id) {
    await hubspotFetch(`/crm/objects/${HS_VERSION}/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({ properties }) });
  } else {
    const created = await hubspotFetch(`/crm/objects/${HS_VERSION}/contacts`, { method: 'POST', body: JSON.stringify({ properties }) });
    id = String(created.id);
  }
  const note = await hubspotFetch(`/crm/objects/${HS_VERSION}/notes`, {
    method: 'POST',
    body: JSON.stringify({ properties: { hs_note_body: input.note, hs_timestamp: new Date().toISOString() } }),
  });
  await hubspotFetch(`/crm/objects/${HS_VERSION}/notes/${note.id}/associations/contacts/${id}/note_to_contact`, { method: 'PUT', body: '{}' }).catch(() => undefined);
  return id;
}
