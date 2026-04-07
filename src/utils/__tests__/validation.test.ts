import { describe, it, expect } from 'vitest'
import {
  validateEthereumAddress,
  validateSolanaAddress,
  validateBitcoinAddress,
  validateCosmosAddress,
  validateSuiAddress,
  validateAptosAddress,
  validateAddress,
} from '../validation'

describe('Address Validation', () => {
  describe('Ethereum', () => {
    it('accepts valid checksummed address', () => {
      expect(validateEthereumAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true)
    })
    it('accepts valid lowercase address', () => {
      expect(validateEthereumAddress('0x0000000000000000000000000000000000000000')).toBe(true)
    })
    it('rejects short address', () => {
      expect(validateEthereumAddress('0xd8dA6BF269')).toBe(false)
    })
    it('rejects missing 0x prefix', () => {
      expect(validateEthereumAddress('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false)
    })
    it('rejects non-hex characters', () => {
      expect(validateEthereumAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false)
    })
  })

  describe('Solana', () => {
    it('accepts valid base58 address', () => {
      expect(validateSolanaAddress('11111111111111111111111111111111')).toBe(true)
    })
    it('accepts 44-char address', () => {
      expect(validateSolanaAddress('4fYNw3dojWmQ4dXtSGE9epjRGy9pFSx62YypT7avPYvA')).toBe(true)
    })
    it('rejects address with 0/O/I/l (invalid base58)', () => {
      expect(validateSolanaAddress('0OIl1111111111111111111111111111')).toBe(false)
    })
    it('rejects too-short address', () => {
      expect(validateSolanaAddress('abc')).toBe(false)
    })
  })

  describe('Bitcoin', () => {
    it('accepts valid P2PKH address (1...)', () => {
      expect(validateBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true)
    })
    it('accepts valid P2SH address (3...)', () => {
      expect(validateBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true)
    })
    it('accepts valid bech32 address', () => {
      expect(validateBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true)
    })
    it('rejects invalid prefix', () => {
      expect(validateBitcoinAddress('2A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false)
    })
    it('rejects too-short address', () => {
      expect(validateBitcoinAddress('1abc')).toBe(false)
    })
  })

  describe('Cosmos', () => {
    it('accepts valid cosmos address', () => {
      expect(validateCosmosAddress('cosmos1fl48vsnmsdzcv85q5d2q4z5ajdha8yu34mf0eh')).toBe(true)
    })
    it('rejects wrong prefix', () => {
      expect(validateCosmosAddress('osmo1fl48vsnmsdzcv85q5d2q4z5ajdha8yu34mf0eh')).toBe(false)
    })
    it('rejects uppercase in body', () => {
      expect(validateCosmosAddress('cosmos1FL48VSNMSDZCV85Q5D2Q4Z5AJDHA8YU34MF0EH')).toBe(false)
    })
  })

  describe('Sui', () => {
    it('accepts valid 66-char hex address', () => {
      const addr = '0x' + 'a'.repeat(64)
      expect(validateSuiAddress(addr)).toBe(true)
    })
    it('rejects short address', () => {
      expect(validateSuiAddress('0xabc')).toBe(false)
    })
  })

  describe('Aptos', () => {
    it('accepts valid 66-char hex address', () => {
      const addr = '0x' + '1'.repeat(64)
      expect(validateAptosAddress(addr)).toBe(true)
    })
    it('rejects missing 0x prefix', () => {
      expect(validateAptosAddress('1'.repeat(64))).toBe(false)
    })
  })

  describe('validateAddress (unified)', () => {
    it('dispatches to correct chain validator', () => {
      expect(validateAddress('0x' + 'a'.repeat(40), 'ethereum')).toBe(true)
      expect(validateAddress('0x' + 'a'.repeat(40), 'solana')).toBe(false)
    })
    it('returns false for unknown chain', () => {
      expect(validateAddress('anything', 'dogecoin' as any)).toBe(false)
    })
    it('returns false for empty/null address', () => {
      expect(validateAddress('', 'ethereum')).toBe(false)
      expect(validateAddress(null as any, 'ethereum')).toBe(false)
    })
  })
})
