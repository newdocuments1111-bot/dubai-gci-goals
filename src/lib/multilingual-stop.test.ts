import { expect, it } from 'vitest';
import { isStopMessage, stopConfirmation } from './whatsapp';
it.each(['stop','unsubscribe','توقف','إلغاء','बंद करो','रुको','band karo','stop karo','message mat bhejo','стоп','отписаться','остановить','не пишите'])('blocks %s', text => expect(isStopMessage(text)).toBe(true));
it('confirms in the client language and script', () => {
  expect(stopConfirmation('band karo')).toContain('band');
  expect(stopConfirmation('बंद करो')).toContain('संदेश');
  expect(stopConfirmation('стоп')).toContain('отписались');
  expect(stopConfirmation('توقف')).toContain('إيقاف');
  expect(stopConfirmation('stop', 'ru')).toContain('отписались');
  expect(isStopMessage('A bus stop near Marina')).toBe(false);
});