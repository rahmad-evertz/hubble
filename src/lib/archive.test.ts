import { beforeEach, describe, expect, it } from 'vitest'
import { loadArchivedRepos, saveArchivedRepos } from './archive'
import { read, write } from './storage'

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage
})

describe('archived repos', () => {
  it('is empty when nothing has been archived', () => {
    expect(loadArchivedRepos()).toEqual([])
  })

  it('round-trips through storage sorted and deduped, so it is a stable cache key', () => {
    expect(saveArchivedRepos(['acme/zeta', 'acme/alpha', 'acme/zeta'])).toEqual([
      'acme/alpha',
      'acme/zeta',
    ])
    expect(loadArchivedRepos()).toEqual(['acme/alpha', 'acme/zeta'])
  })

  it('unarchives by saving the list without the repo', () => {
    saveArchivedRepos(['acme/alpha', 'acme/zeta'])
    saveArchivedRepos(['acme/zeta'])
    expect(loadArchivedRepos()).toEqual(['acme/zeta'])
  })

  it('drops invalid stored entries instead of letting them break every panel query', () => {
    write('archivedRepos', ['acme/ok', 'acme/x author:evil', 42, null])
    expect(loadArchivedRepos()).toEqual(['acme/ok'])
  })

  it('treats a stored non-array as empty', () => {
    write('archivedRepos', 'acme/ok')
    expect(loadArchivedRepos()).toEqual([])
    expect(read('archivedRepos', null)).toBe('acme/ok')
  })
})
