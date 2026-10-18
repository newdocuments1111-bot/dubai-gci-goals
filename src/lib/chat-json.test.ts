import { expect, it } from 'vitest';
import { parseChatJson } from './chat-json';
it('does not join image analysis JSON with the final answer', () => {
  expect(parseChatJson('{"description":"image"}\n{"reply":"Helpful answer","learned":{"location":"Marina"}}')['reply']).toBe('Helpful answer');
});
it('preserves braces and escaped quotes inside client reply strings', () => {
  expect(parseChatJson('```json\n{"reply":"A {home} with \\"views\\""}\n```')['reply']).toBe('A {home} with "views"');
});