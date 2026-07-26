const PREFIX = 'hubble.'

/**
 * localStorage with a namespace and no throwing. Access can fail outright in
 * private-browsing modes and when a quota is exceeded, and a dashboard should
 * degrade to "settings don't persist" rather than fail to render.
 */
export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Ignore: persistence is a convenience, not a requirement.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // Ignore.
  }
}
