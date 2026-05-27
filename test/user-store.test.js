import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_VAULT_KEY,
  createProfile,
  deleteProfile,
  loadProfiles,
  loadVault,
  migrateLegacyVault,
  selectedProfile
} from "../js/user-store.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test("conserve un coffre distinct pour chaque utilisateur", () => {
  const storage = memoryStorage();
  const patrick = createProfile("Patrick", { ciphertext: "patrick" }, storage);
  const second = createProfile("Autre", { ciphertext: "autre" }, storage);

  assert.equal(loadProfiles(storage).length, 2);
  assert.deepEqual(loadVault(patrick.id, storage), { ciphertext: "patrick" });
  assert.deepEqual(loadVault(second.id, storage), { ciphertext: "autre" });
  assert.equal(selectedProfile(loadProfiles(storage), storage).id, second.id);
});

test("supprimer un utilisateur préserve le coffre restant", () => {
  const storage = memoryStorage();
  const first = createProfile("Premier", { ciphertext: "premier" }, storage);
  const kept = createProfile("Conservé", { ciphertext: "conserve" }, storage);

  deleteProfile(first.id, storage);

  assert.deepEqual(loadVault(kept.id, storage), { ciphertext: "conserve" });
  assert.equal(selectedProfile(loadProfiles(storage), storage).id, kept.id);
});

test("migre le carnet historique vers un utilisateur sans perdre son coffre", () => {
  const legacyEnvelope = { ciphertext: "ancien-carnet" };
  const storage = memoryStorage({ [LEGACY_VAULT_KEY]: JSON.stringify(legacyEnvelope) });

  const profiles = migrateLegacyVault(storage);

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].name, "Mon carnet existant");
  assert.deepEqual(loadVault(profiles[0].id, storage), legacyEnvelope);
  assert.equal(storage.getItem(LEGACY_VAULT_KEY), null);
});
