import { describe, it, expect, beforeEach, vi } from 'vitest'
import { secureWipe, wipeObject, unlock, lock, isUnlocked } from '../profiles'

describe('profiles', () => {
  describe('secureWipe', () => {
    it('zeroes out a Uint8Array', () => {
      const buf = new Uint8Array([1, 2, 3, 4, 5])
      secureWipe(buf)
      expect(buf.every(b => b === 0)).toBe(true)
    })

    it('handles empty buffer', () => {
      const buf = new Uint8Array(0)
      secureWipe(buf)
      expect(buf.length).toBe(0)
    })

    it('ignores non-Uint8Array input', () => {
      // Should not throw
      secureWipe(null as any)
      secureWipe('string' as any)
      secureWipe(42 as any)
    })
  })

  describe('wipeObject', () => {
    it('nullifies all fields and wipes typed arrays', () => {
      const obj = {
        key: new Uint8Array([10, 20, 30]),
        name: 'test',
        count: 5,
      }
      wipeObject(obj)
      expect(obj.key).toBeNull()
      expect(obj.name).toBeNull()
      expect(obj.count).toBeNull()
    })

    it('handles null/undefined gracefully', () => {
      wipeObject(null)
      wipeObject(undefined as any)
    })
  })

  describe('session lock/unlock', () => {
    beforeEach(() => {
      lock()
    })

    it('starts locked', () => {
      expect(isUnlocked()).toBe(false)
    })

    it('unlocks with password', () => {
      unlock('testpassword')
      expect(isUnlocked()).toBe(true)
    })

    it('locks again after lock()', () => {
      unlock('testpassword')
      expect(isUnlocked()).toBe(true)
      lock()
      expect(isUnlocked()).toBe(false)
    })
  })
})
