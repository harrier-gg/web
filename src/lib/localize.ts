import type { LocalizedTextDto } from '../api/types.gen';

/** Picks the text in the current language; English is always present (ADR 0003). */
export function localize(text: LocalizedTextDto | undefined, language: string | undefined): string {
  if (!text) return '';
  return (language === 'de' && text.de) || text.en;
}
