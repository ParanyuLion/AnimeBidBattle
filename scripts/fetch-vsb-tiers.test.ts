import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script without type declarations
import { parseOrigin, parseTiers, powersSection } from './fetch-vsb-tiers.mjs';

const WIKITEXT = `==Summary==
Text.

==Powers and Stats==
'''[[Tiering System|Tier]]:''' {{9-B}} | At least {{9-B}}, up to at least {{6-A}} | {{High 7-C}}, possibly {{Unknown}}

'''Origin:''' [[One-Punch Man]]

==Gallery==
x`;

describe('fetch-vsb-tiers parsing', () => {
  it('slices the Powers and Stats section only', () => {
    const section = powersSection(WIKITEXT);
    expect(section).toContain('Tier');
    expect(section).not.toContain('Gallery');
    expect(powersSection('==Summary==\nnothing')).toBe('');
  });

  it('lists every tier token in order', () => {
    expect(parseTiers(powersSection(WIKITEXT))).toEqual(['9-B', '9-B', '6-A', 'High 7-C', 'Unknown']);
  });

  it('reads the origin series', () => {
    expect(parseOrigin(powersSection(WIKITEXT))).toBe('One-Punch Man');
  });
});
