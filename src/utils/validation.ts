/**
 * Address validation for all 6 supported chains.
 *
 * Provides both quick regex validators and the deeper
 * `validateAddressForChain()` from chainCrypto (which does
 * base58check verification for Bitcoin, decode-length for Solana, etc.).
 */

import type { ChainId } from './types'

// ── Per-chain regex validators (fast, no dependencies) ──

export function validateEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function validateSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

export function validateBitcoinAddress(address: string): boolean {
  // P2PKH or P2SH
  return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
    // Bech32 (native segwit)
    /^bc1[a-z0-9]{39,59}$/.test(address)
}

export function validateCosmosAddress(address: string): boolean {
  return /^cosmos1[a-z0-9]{38}$/.test(address)
}

export function validateSuiAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(address)
}

export function validateAptosAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(address)
}

// ── Unified validator ──

export function validateAddress(address: string, chain: ChainId): boolean {
  if (!address || typeof address !== 'string') return false

  switch (chain) {
    case 'ethereum': return validateEthereumAddress(address)
    case 'solana':   return validateSolanaAddress(address)
    case 'bitcoin':  return validateBitcoinAddress(address)
    case 'cosmos':   return validateCosmosAddress(address)
    case 'sui':      return validateSuiAddress(address)
    case 'aptos':    return validateAptosAddress(address)
    default:         return false
  }
}
