const CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateToken(length = 6): string {
  const values = new Uint32Array(length);

  crypto.getRandomValues(values);

  return Array.from(
    values,
    (value) => CHARACTERS[value % CHARACTERS.length],
  ).join("");
}