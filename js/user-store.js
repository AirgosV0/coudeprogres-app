export const LEGACY_VAULT_KEY = "coudeprogres.vault.v1";
export const USERS_KEY = "coudeprogres.users.v1";
export const SELECTED_USER_KEY = "coudeprogres.selected-user.v1";

const USER_VAULT_PREFIX = "coudeprogres.user-vault.v1.";

export function migrateLegacyVault(storage = localStorage) {
  const profiles = loadProfiles(storage);
  const saved = storage.getItem(LEGACY_VAULT_KEY);
  if (profiles.length || !saved) return profiles;
  try {
    const profile = createProfile("Mon carnet existant", JSON.parse(saved), storage);
    storage.removeItem(LEGACY_VAULT_KEY);
    return [profile];
  } catch {
    return profiles;
  }
}

export function loadProfiles(storage = localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(USERS_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.filter(profile => profile && profile.id && profile.name)
      : [];
  } catch {
    return [];
  }
}

export function selectedProfile(profiles, storage = localStorage) {
  const selectedId = storage.getItem(SELECTED_USER_KEY);
  return profiles.find(profile => profile.id === selectedId) || profiles[0] || null;
}

export function selectProfile(profileId, storage = localStorage) {
  storage.setItem(SELECTED_USER_KEY, profileId);
}

export function createProfile(name, envelope, storage = localStorage) {
  const safeName = name.trim();
  if (!safeName) throw new Error("Indiquez un nom pour cet utilisateur.");
  const profile = {
    id: crypto.randomUUID(),
    name: safeName,
    createdAt: new Date().toISOString()
  };
  const profiles = [...loadProfiles(storage), profile];
  storage.setItem(USERS_KEY, JSON.stringify(profiles));
  saveVault(profile.id, envelope, storage);
  selectProfile(profile.id, storage);
  return profile;
}

export function deleteProfile(profileId, storage = localStorage) {
  const profiles = loadProfiles(storage).filter(profile => profile.id !== profileId);
  storage.removeItem(vaultKey(profileId));
  storage.setItem(USERS_KEY, JSON.stringify(profiles));
  const next = profiles[0] || null;
  if (next) selectProfile(next.id, storage);
  else storage.removeItem(SELECTED_USER_KEY);
  return profiles;
}

export function loadVault(profileId, storage = localStorage) {
  try {
    const saved = storage.getItem(vaultKey(profileId));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveVault(profileId, envelope, storage = localStorage) {
  storage.setItem(vaultKey(profileId), JSON.stringify(envelope));
}

function vaultKey(profileId) {
  return `${USER_VAULT_PREFIX}${profileId}`;
}
