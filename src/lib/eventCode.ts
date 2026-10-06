import { randomInt } from "crypto";

// Excludes ambiguous characters (0/O, 1/I/L) so codes are easy to read and
// type back correctly from a screen or a printed card.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

export function generateEventCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
