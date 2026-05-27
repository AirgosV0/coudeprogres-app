const ITERATIONS = 310000;

export async function createVault(journal, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(canonicalPassphrase(passphrase), salt, ITERATIONS);
  return {
    key,
    envelope: await encryptJournal(journal, key, { salt: encode(salt), iterations: ITERATIONS })
  };
}

export async function unlockVault(envelope, passphrase) {
  validateEnvelope(envelope);
  const candidates = [...new Set([passphrase, canonicalPassphrase(passphrase)])];
  for (const candidate of candidates) {
    try {
      const key = await deriveKey(candidate, decode(envelope.salt), envelope.iterations);
      const journal = await decryptJournal(envelope, key);
      return { key, journal };
    } catch {
      // Try the normalized phrase for vaults created before normalization was added.
    }
  }
  throw new Error("Phrase secrète incorrecte.");
}

export async function encryptJournal(journal, key, sourceEnvelope) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(journal));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    format: "CoudeProgres",
    version: 1,
    salt: sourceEnvelope.salt,
    iterations: sourceEnvelope.iterations,
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(encrypted)),
    updatedAt: new Date().toISOString()
  };
}

export async function decryptJournal(envelope, key) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(envelope.iv) },
    key,
    decode(envelope.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export function validateEnvelope(envelope) {
  if (
    !envelope ||
    envelope.format !== "CoudeProgres" ||
    envelope.version !== 1 ||
    !envelope.salt ||
    !envelope.iv ||
    !envelope.ciphertext ||
    !envelope.iterations
  ) {
    throw new Error("Cette sauvegarde n'est pas reconnue.");
  }
}

async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function canonicalPassphrase(passphrase) {
  return passphrase.normalize("NFC").trim();
}

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function decode(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}
