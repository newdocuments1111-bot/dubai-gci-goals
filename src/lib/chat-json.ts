/** Extract a complete JSON answer without greedily joining separate objects. */
export function parseChatJson(text: string): Record<string, unknown> {
  let start = -1, depth = 0, quoted = false, escaped = false;
  const objects: Record<string, unknown>[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (start < 0) { if (c === '{') { start = i; depth = 1; } continue; }
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { const obj: unknown = JSON.parse(text.slice(start, i + 1)); if (obj && typeof obj === 'object' && !Array.isArray(obj)) objects.push(obj as Record<string, unknown>); } catch { /* Ignore malformed fragments. */ }
      start = -1;
    }
  }
  const answer = objects.findLast(o => typeof o['reply'] === 'string') ?? objects.at(-1);
  if (!answer) throw new Error('AI returned an unreadable answer.');
  return answer;
}