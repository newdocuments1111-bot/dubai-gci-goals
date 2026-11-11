import { describe, expect, it } from 'vitest';
import { clientScript, detectLanguage, formatReplyTime, LANGUAGES, normaliseLanguage, replyDictionaries, t, type ReplyKey } from './reply-i18n';
describe('client language', () => {
  it.each([['hi-Latn','hi'],['Hinglish','hi'],['Hindi','hi'],['ar-AE','ar'],['ru_RU','ru'],['en-GB','en'],['fr','en']])('normalises %s to %s', (input, expected) => expect(normaliseLanguage(input)).toBe(expected));
  it('detects Hinglish and preserves script switches', () => {
    expect(detectLanguage('mujhe marina me 2 bhk chahiye')).toBe('hi');
    expect(clientScript('mujhe marina me 2 bhk chahiye')).toBe('latin');
    expect(clientScript('मुझे घर चाहिए')).toBe('native');
    expect(detectLanguage('Я ищу квартиру','hi')).toBe('ru');
    expect(detectLanguage('I need an apartment','ar')).toBe('en');
    expect(detectLanguage('2', 'ru')).toBe('ru');
  });
  it.each([...LANGUAGES, 'hiLatin'] as const)('fills every key in %s', lang => {
    const vars = { time:'TIME',local:'LOCAL',meet:'MEET',calendar:'CALENDAR',times:'TIMES',agency:'AGENCY',listings:'LISTINGS' };
    for (const key of Object.keys(replyDictionaries.en) as ReplyKey[]) {
      const output = t(lang === 'hiLatin' ? 'hi' : lang, key, vars, lang === 'hiLatin' ? 'latin' : 'native');
      expect(output.length).toBeGreaterThan(0);
      expect(output).not.toMatch(/\{\w+\}/);
      const placeholders = (replyDictionaries.en[key].match(/\{\w+\}/g) ?? []).sort();
      expect((replyDictionaries[lang][key].match(/\{\w+\}/g) ?? []).sort()).toEqual(placeholders);
    }
  });
  it('keeps Hinglish calendar labels Latin and Dubai time', () => {
    expect(formatReplyTime('2026-11-11T05:00:00Z','hi','Asia/Dubai','latin')).not.toMatch(/[\u0900-\u097f]/);
    expect(formatReplyTime('2026-11-11T05:00:00Z','en')).toContain('9:00');
  });
});