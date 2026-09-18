const storageKey = "northline.session";

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }
    const created = generateId();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return generateId();
  }
}
