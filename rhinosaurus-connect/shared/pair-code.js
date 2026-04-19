import { PAIR_CODE_LENGTH } from './constants.js';

const ALLOWED_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generatePairCode() {
  let code = '';
  const array = new Uint8Array(PAIR_CODE_LENGTH);
  crypto.getRandomValues(array);
  for (let i = 0; i < PAIR_CODE_LENGTH; i++) {
    code += ALLOWED_CHARS[array[i] % ALLOWED_CHARS.length];
  }
  return code;
}

export function isValidPairCode(code) {
  if (!code || code.length !== PAIR_CODE_LENGTH) return false;
  for (const char of code) {
    if (!ALLOWED_CHARS.includes(char)) return false;
  }
  return true;
}
