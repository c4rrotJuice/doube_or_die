export function formatJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function assertEnv(name, value) {
  if (!value) {
    console.warn(`[config] Missing ${name}. Update your local config before using auth/API calls.`);
  }
}
