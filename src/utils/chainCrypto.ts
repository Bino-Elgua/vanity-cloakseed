import * as secp256k1 from '@noble/secp256k1'
import * as ed25519 from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import { keccak_256, sha3_256 } from '@noble/hashes/sha3'
import { sha256 } from '@noble/hashes/sha256'
import { ripemd160 } from '@noble/hashes/ripemd160'
import { blake2b } from '@noble/hashes/blake2b'
import bs58 from 'bs58'
import type { Chain, ChainId, KeyPair, GeneratedAddress, HashType, ValidationResult } from './types'

// @noble/ed25519 v2 requires sha512Sync on the `etc` object for sync key ops
if (!ed25519.etc.sha512Sync) {
  ed25519.etc.sha512Sync = (...m: Uint8Array[]) => sha512(...m)
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace('0x', '')
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < h.length; i += 2) {
    bytes[i / 2] = parseInt(h.substr(i, 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Base58Check encoding (Bitcoin) ──

function base58CheckEncode(version: number, payload: Uint8Array): string {
  const data = new Uint8Array(1 + payload.length)
  data[0] = version
  data.set(payload, 1)
  const checksum = sha256(sha256(data)).slice(0, 4)
  const full = new Uint8Array(data.length + 4)
  full.set(data)
  full.set(checksum, data.length)
  return bs58.encode(full)
}

// ── Bech32 encoding (Cosmos) ──

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const v of values) {
    const b = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i]
    }
  }
  return chk
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = []
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5)
  ret.push(0)
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31)
  return ret
}

function bech32CreateChecksum(hrp: string, data: number[]): number[] {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]
  const polymod = bech32Polymod(values) ^ 1
  const ret: number[] = []
  for (let i = 0; i < 6; i++) ret.push((polymod >> (5 * (5 - i))) & 31)
  return ret
}

function bech32Encode(hrp: string, data5bit: number[]): string {
  const checksum = bech32CreateChecksum(hrp, data5bit)
  const combined = [...data5bit, ...checksum]
  return hrp + '1' + combined.map(d => BECH32_CHARSET[d]).join('')
}

function convertBits(data: Uint8Array, fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0, bits = 0
  const ret: number[] = []
  const maxv = (1 << toBits) - 1
  for (const value of data) {
    acc = (acc << fromBits) | value
    bits += fromBits
    while (bits >= toBits) {
      bits -= toBits
      ret.push((acc >> bits) & maxv)
    }
  }
  if (pad) {
    if (bits > 0) ret.push((acc << (toBits - bits)) & maxv)
  }
  return ret
}

// ── Hash function selector ──

export function getHashFunction(hashType: HashType): (data: Uint8Array) => Uint8Array {
  switch (hashType) {
    case 'keccak256': return (data) => keccak_256(data)
    case 'sha256':    return (data) => sha256(data)
    case 'blake2b':   return (data) => blake2b(data, { dkLen: 32 })
    case 'sha3':      return (data) => sha3_256(data)
    default:          return (data) => keccak_256(data)
  }
}

// ── Key generation ──

export async function generateKeyForChain(chain: Chain): Promise<KeyPair> {
  const privateKey = crypto.getRandomValues(new Uint8Array(32))
  if (chain.curve === 'ed25519') {
    const publicKey = await ed25519.getPublicKey(privateKey)
    return { privateKey: bytesToHex(privateKey), publicKey: bytesToHex(publicKey), privateKeyBytes: privateKey, publicKeyBytes: publicKey }
  } else {
    const publicKey = secp256k1.getPublicKey(privateKey, false)
    return { privateKey: bytesToHex(privateKey), publicKey: bytesToHex(publicKey), privateKeyBytes: privateKey, publicKeyBytes: publicKey }
  }
}

// ── Address derivation ──

export async function generateAddressForChain(chain: Chain, privateKey: string | Uint8Array): Promise<GeneratedAddress> {
  const privKeyBytes = typeof privateKey === 'string' ? hexToBytes(privateKey) : privateKey
  const hashFn = getHashFunction(chain.hash)

  let publicKeyBytes: Uint8Array
  if (chain.curve === 'ed25519') {
    publicKeyBytes = await ed25519.getPublicKey(privKeyBytes)
  } else {
    const compressed = chain.id !== 'ethereum'
    publicKeyBytes = secp256k1.getPublicKey(privKeyBytes, compressed)
  }

  let address: string
  switch (chain.id) {
    case 'ethereum': address = deriveEthereumAddress(publicKeyBytes, hashFn); break
    case 'solana':   address = deriveSolanaAddress(publicKeyBytes); break
    case 'bitcoin':  address = deriveBitcoinAddress(publicKeyBytes); break
    case 'sui':      address = deriveSuiAddress(publicKeyBytes); break
    case 'cosmos':   address = deriveCosmosAddress(publicKeyBytes); break
    case 'aptos':    address = deriveAptosAddress(publicKeyBytes); break
    default:         address = deriveEthereumAddress(publicKeyBytes, hashFn)
  }

  return { address, privateKey: bytesToHex(privKeyBytes), publicKey: bytesToHex(publicKeyBytes) }
}

function deriveEthereumAddress(publicKey: Uint8Array, hashFn: (d: Uint8Array) => Uint8Array): string {
  const pubBytes = publicKey.slice(1)
  const hash = hashFn(pubBytes)
  return toChecksumAddress('0x' + bytesToHex(hash).slice(-40))
}

function deriveSolanaAddress(publicKey: Uint8Array): string {
  return bs58.encode(publicKey)
}

function deriveBitcoinAddress(publicKey: Uint8Array): string {
  const sha256Hash = sha256(publicKey)
  const hash160 = ripemd160(sha256Hash)
  return base58CheckEncode(0x00, hash160)
}

function deriveSuiAddress(publicKey: Uint8Array): string {
  const flagged = new Uint8Array(1 + publicKey.length)
  flagged[0] = 0x00
  flagged.set(publicKey, 1)
  const hash = blake2b(flagged, { dkLen: 32 })
  return '0x' + bytesToHex(hash)
}

function deriveCosmosAddress(publicKey: Uint8Array): string {
  const sha256Hash = sha256(publicKey)
  const hash160 = ripemd160(sha256Hash)
  const words = convertBits(hash160, 8, 5, true)
  return bech32Encode('cosmos', words)
}

function deriveAptosAddress(publicKey: Uint8Array): string {
  const combined = new Uint8Array(publicKey.length + 1)
  combined.set(publicKey)
  combined[publicKey.length] = 0x00
  const hash = sha3_256(combined)
  return '0x' + bytesToHex(hash)
}

function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().slice(2)
  const hashHex = bytesToHex(keccak_256(new TextEncoder().encode(addr)))
  let checksum = '0x'
  for (let i = 0; i < addr.length; i++) {
    checksum += parseInt(hashHex[i], 16) >= 8 ? addr[i].toUpperCase() : addr[i]
  }
  return checksum
}

// ── Per-chain address validation ──

const ADDRESS_VALIDATORS: Record<string, (addr: string) => boolean> = {
  ethereum: (addr) => /^0x[0-9a-fA-F]{40}$/.test(addr),
  solana: (addr) => {
    try { return bs58.decode(addr).length === 32 }
    catch { return false }
  },
  bitcoin: (addr) => {
    try {
      const decoded = bs58.decode(addr)
      if (decoded.length !== 25) return false
      const payload = decoded.slice(0, 21)
      const checksum = decoded.slice(21)
      const hash = sha256(sha256(payload))
      return hash[0] === checksum[0] && hash[1] === checksum[1] &&
             hash[2] === checksum[2] && hash[3] === checksum[3]
    } catch { return false }
  },
  sui:    (addr) => /^0x[0-9a-fA-F]{64}$/.test(addr),
  cosmos: (addr) => /^cosmos1[a-z0-9]{38}$/.test(addr),
  aptos:  (addr) => /^0x[0-9a-fA-F]{64}$/.test(addr),
}

export function validateAddressForChain(address: string, chainId: string): ValidationResult {
  const validator = ADDRESS_VALIDATORS[chainId]
  if (!validator) return { valid: false, error: `Unknown chain: ${chainId}` }
  const valid = validator(address)
  return { valid, error: valid ? null : `Invalid ${chainId} address format` }
}

export function matchesPatternForChain(address: string, chain: Chain, prefix: string, suffix: string): boolean {
  if (chain.id === 'bitcoin' || chain.id === 'solana') {
    const addr = chain.id === 'bitcoin' ? address.slice(1) : address
    return (!prefix || addr.startsWith(prefix)) && (!suffix || addr.endsWith(suffix))
  }
  if (chain.id === 'cosmos') {
    const addr = address.replace(/^cosmos1/, '')
    return (!prefix || addr.startsWith(prefix.toLowerCase())) && (!suffix || addr.endsWith(suffix.toLowerCase()))
  }
  const hexAddr = address.replace(/^0x/, '').toLowerCase()
  return (!prefix || hexAddr.startsWith(prefix.toLowerCase())) && (!suffix || hexAddr.endsWith(suffix.toLowerCase()))
}
