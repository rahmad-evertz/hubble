import { DEFAULT_API_BASE } from '../api/client'
import type { AppConfig } from '../types'
import * as storage from './storage'

const STORAGE_KEY = 'config'

export const BLANK_CONFIG: AppConfig = {
  githubToken: '',
  username: '',
  org: '',
  apiBaseUrl: DEFAULT_API_BASE,
  ticketPattern: '',
  ticketBaseUrl: '',
}

/**
 * Optional build-time defaults. The deployed copy is generated blank by CI and
 * the local copy is gitignored, so a 404 here is the normal case, not an error.
 * It exists so a fork can ship a default org, or a developer can pre-fill a
 * token to skip the setup screen while iterating.
 */
async function fromFile(): Promise<Partial<AppConfig>> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config/app-config.json`, {
      cache: 'no-store',
    })
    if (!res.ok) return {}
    return (await res.json()) as Partial<AppConfig>
  } catch {
    return {}
  }
}

/** Drop blank values so an all-empty config file cannot clobber real defaults. */
function withoutBlanks(partial: Partial<AppConfig>): Partial<AppConfig> {
  const out: Partial<AppConfig> = {}
  for (const [key, value] of Object.entries(partial)) {
    if (typeof value === 'string' && value.trim() !== '') {
      out[key as keyof AppConfig] = value.trim()
    }
  }
  return out
}

/**
 * Precedence: blank defaults < config file < what the user saved in this browser.
 * Saved config is applied wholesale rather than blank-filtered, so deliberately
 * clearing the org in Settings sticks instead of falling back to the file value.
 */
export async function loadConfig(): Promise<AppConfig> {
  const file = withoutBlanks(await fromFile())
  const saved = storage.read<Partial<AppConfig> | null>(STORAGE_KEY, null)
  return { ...BLANK_CONFIG, ...file, ...(saved ?? {}) }
}

export function saveConfig(config: AppConfig): void {
  storage.write(STORAGE_KEY, config)
}

export function clearConfig(): void {
  storage.remove(STORAGE_KEY)
}

/**
 * Enough to render a dashboard. The org is intentionally not required — leaving
 * it blank widens every search to all repos the token can see, which is a
 * legitimate way to use the app rather than an incomplete setup.
 */
export function isConfigured(config: AppConfig): boolean {
  return Boolean(config.githubToken && config.username)
}
