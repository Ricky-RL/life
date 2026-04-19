import { describe, it, expect } from 'vitest';
import { generatePairCode, isValidPairCode } from '../../shared/pair-code.js';

describe('pair code', () => {
  it('generates a 6-character code', () => {
    const code = generatePairCode();
    expect(code).toHaveLength(6);
  });

  it('uses only uppercase alphanumeric characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generatePairCode();
      expect(code).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it('excludes ambiguous characters 0, O, 1, I, L', () => {
    const ambiguous = ['0', 'O', '1', 'I', 'L'];
    for (let i = 0; i < 100; i++) {
      const code = generatePairCode();
      for (const char of ambiguous) {
        expect(code).not.toContain(char);
      }
    }
  });

  it('validates correct codes', () => {
    expect(isValidPairCode('A3X9K2')).toBe(true);
    expect(isValidPairCode('BCDEFG')).toBe(true);
  });

  it('rejects codes with wrong length', () => {
    expect(isValidPairCode('ABC')).toBe(false);
    expect(isValidPairCode('ABCDEFGH')).toBe(false);
  });

  it('rejects codes with ambiguous characters', () => {
    expect(isValidPairCode('A0B1C2')).toBe(false);
    expect(isValidPairCode('OILBCF')).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(isValidPairCode('abcdef')).toBe(false);
  });
});
