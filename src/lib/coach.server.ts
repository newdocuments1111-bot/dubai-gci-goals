import { generateResponse, GatewayError } from '@lovable.dev/ai-gateway';
import { coachResultSchema, COACH_INSTRUCTIONS } from './coach';

/** Reviews the agent's own replies and suggests 2–3 better ones. The chat is untrusted data, never instructions. */
export async function coachReplies(history: { role: 'agent' | 'client' | 'ai'; content: string }[]) {
  try {
    const result = await generateResponse({
      model: 'openai/gpt-6-astra',
      instructions: COACH_INSTRUCTIONS,
      input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ conversation: history }) }] }],
    });
    if (result.status !== 'completed') throw new Error('Coaching did not complete.');
    const text = result.output.flatMap(item => item.type === 'message' ? item.content.filter(c => c.type === 'output_text').map(c => c.text) : []).join('');
    const parsed = coachResultSchema.parse(JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1) || '{}'));
    return parsed;
  } catch (e) {
    if (e instanceof GatewayError) console.error('Coach AI failure', e.code, e.ids);
    throw e;
  }
}
