export interface ConnectionToken {
  peerId: string;
  token: string;
}

export function createConnectionToken(peerId: string): string {
  const payload = JSON.stringify({
    p: peerId,
    t: crypto.randomUUID(),
  });

  return btoa(payload)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function parseConnectionToken(value: string): ConnectionToken {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  const payload = JSON.parse(atob(padded));

  if (!payload.p || !payload.t) {
    throw new Error("Invalid connection token");
  }

  return {
    peerId: payload.p,
    token: payload.t,
  };
}