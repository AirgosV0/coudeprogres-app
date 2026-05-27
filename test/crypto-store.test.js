import test from "node:test";
import assert from "node:assert/strict";
import { createVault, encryptJournal, unlockVault } from "../js/crypto-store.js";

test("un carnet chiffré peut être rouvert avec la phrase secrète", async () => {
  const original = { version: 1, entries: [{ title: "Séance privée" }] };
  const { envelope } = await createVault(original, "phrase-secrete-fiable");
  assert.doesNotMatch(envelope.ciphertext, /Séance privée/);
  const unlocked = await unlockVault(envelope, "phrase-secrete-fiable");
  assert.deepEqual(unlocked.journal, original);
});

test("une mauvaise phrase secrète ne déverrouille pas le carnet", async () => {
  const { envelope } = await createVault({ version: 1, entries: [] }, "bonne-phrase-secrete");
  await assert.rejects(() => unlockVault(envelope, "mauvaise-phrase"));
});

test("les modifications restent lisibles après un nouvel enregistrement chiffré", async () => {
  const { envelope, key } = await createVault({ version: 1, entries: [] }, "phrase-secrete-fiable");
  const changed = { version: 1, entries: [{ title: "Autorééducation" }] };
  const saved = await encryptJournal(changed, key, envelope);
  const reopened = await unlockVault(saved, "phrase-secrete-fiable");
  assert.deepEqual(reopened.journal, changed);
});
