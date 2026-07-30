import { beforeEach, describe, expect, it } from 'vitest'
import { read, remove, write } from './storage'

/**
 * Node has no global localStorage; a minimal Map-backed stand-in is enough to
 * exercise read/write/remove without pulling in a DOM test environment.
 */
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

describe('read', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(read('missing', 'fallback')).toBe('fallback')
  })

  it('round-trips a value written through write()', () => {
    write('key', { a: 1 })
    expect(read<{ a: number } | null>('key', null)).toEqual({ a: 1 })
  })

  it('namespaces keys under the hubble. prefix', () => {
    write('key', 'value')
    expect(localStorage.getItem('hubble.key')).toBe('"value"')
  })

  it('falls back on corrupted JSON rather than throwing', () => {
    localStorage.setItem('hubble.broken', '{not json')
    expect(read('broken', 'fallback')).toBe('fallback')
  })

  it('falls back when localStorage access throws', () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error('blocked in private browsing')
      },
    } as unknown as Storage
    expect(read('key', 'fallback')).toBe('fallback')
  })
})

describe('write', () => {
  it('JSON-serializes the value', () => {
    write('key', [1, 2, 3])
    expect(localStorage.getItem('hubble.key')).toBe('[1,2,3]')
  })

  it('swallows a write failure instead of throwing', () => {
    globalThis.localStorage = {
      setItem: () => {
        throw new Error('quota exceeded')
      },
    } as unknown as Storage
    expect(() => write('key', 'value')).not.toThrow()
  })
})

describe('remove', () => {
  it('deletes a previously written key', () => {
    write('key', 'value')
    remove('key')
    expect(read('key', 'fallback')).toBe('fallback')
  })

  it('swallows a removal failure instead of throwing', () => {
    globalThis.localStorage = {
      removeItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(() => remove('key')).not.toThrow()
  })
})
