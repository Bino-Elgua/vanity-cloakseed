import { sha256 } from '@noble/hashes/sha256'
import * as bip39 from 'bip39'
import type {
  CipherMap, CipherValidation, CloakValidation, PanicPhrase,
  EncryptedCipherV2, Bip39WordlistValidation,
} from './types'

const BIP39_WORDS: string[] = bip39.wordlists.EN

// ── Wordlist validation ──

export function validateBip39Wordlist(): Bip39WordlistValidation {
  if (!BIP39_WORDS || BIP39_WORDS.length !== 2048) {
    return { valid: false, error: `Expected 2048 BIP-39 words, got ${BIP39_WORDS?.length || 0}` }
  }
  const checks: [number, string][] = [[0, 'abandon'], [2047, 'zoo'], [1024, 'length']]
  for (const [idx, expected] of checks) {
    if (BIP39_WORDS[idx] !== expected) {
      return { valid: false, error: `Wordlist mismatch at index ${idx}: expected "${expected}", got "${BIP39_WORDS[idx]}"` }
    }
  }
  return { valid: true }
}

// ── Cipher generation ──

export function generateCipher(customWords: string[]): CipherMap {
  if (customWords.length !== 2048) throw new Error('Cipher must contain exactly 2048 words')
  const uniqueWords = new Set(customWords)
  if (uniqueWords.size !== 2048) throw new Error('All cipher words must be unique')
  const cipherMap: CipherMap = {}
  customWords.forEach((word, index) => { cipherMap[word.toLowerCase()] = index })
  return cipherMap
}

export function generateCipherFromTheme(themeWords: string[], customizations: Record<string, string> = {}): CipherMap {
  const cipher = [...themeWords]
  Object.entries(customizations).forEach(([oldWord, newWord]) => {
    const index = cipher.indexOf(oldWord)
    if (index !== -1) cipher[index] = newWord
  })
  return generateCipher(cipher)
}

// ── Encode / Decode ──

export function encodePhrase(bip39Phrase: string, cipherWords: string[]): string {
  if (!bip39.validateMnemonic(bip39Phrase.trim())) {
    throw new Error('Invalid BIP-39 mnemonic phrase')
  }
  if (!cipherWords || cipherWords.length !== 2048) {
    throw new Error('Cipher must contain exactly 2048 words')
  }
  return bip39Phrase.trim().split(/\s+/).map(word => {
    const index = BIP39_WORDS.indexOf(word.toLowerCase())
    if (index === -1) throw new Error(`Word "${word}" is not in the BIP-39 wordlist`)
    return cipherWords[index]
  }).join(' ')
}

export function decodePhrase(cloakPhrase: string, cipherWords: string[]): string {
  if (!cipherWords || cipherWords.length !== 2048) {
    throw new Error('Cipher must contain exactly 2048 words')
  }
  const cipherLookup = new Map<string, number>(cipherWords.map((w, i) => [w.toLowerCase(), i]))
  const decoded = cloakPhrase.trim().split(/\s+/).map(word => {
    const index = cipherLookup.get(word.toLowerCase())
    if (index === undefined) throw new Error(`Invalid cloak word: "${word}" not found in cipher`)
    if (index >= BIP39_WORDS.length) throw new Error(`Cipher index ${index} out of BIP-39 range`)
    return BIP39_WORDS[index]
  }).join(' ')
  if (!bip39.validateMnemonic(decoded)) {
    throw new Error('Decoded phrase failed BIP-39 checksum validation')
  }
  return decoded
}

// ── Validation ──

export function validateCipher(cipherWords: string[]): CipherValidation {
  if (!Array.isArray(cipherWords)) return { isValid: false, error: 'Cipher must be an array' }
  if (cipherWords.length !== 2048) return { isValid: false, error: `Cipher must have exactly 2048 words, got ${cipherWords.length}` }
  const uniqueWords = new Set(cipherWords.map(w => w.toLowerCase()))
  if (uniqueWords.size !== 2048) return { isValid: false, error: 'All cipher words must be unique' }
  if (cipherWords.some(w => !w || typeof w !== 'string' || w.trim() === '')) {
    return { isValid: false, error: 'Cipher contains invalid or empty words' }
  }
  return { isValid: true }
}

export function hashCipher(cipherWords: string[]): string {
  const cipherString = cipherWords.join('|')
  const hash = sha256(new TextEncoder().encode(cipherString))
  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Panic phrase ──

export function generatePanicPhrase(cipherWords: string[], _panicInput: string = ''): PanicPhrase {
  const entropy = crypto.getRandomValues(new Uint8Array(16))
  const entropyHex = Array.from(entropy).map(b => b.toString(16).padStart(2, '0')).join('')
  const fakeSeed = bip39.entropyToMnemonic(entropyHex)
  const fakeCloak = encodePhrase(fakeSeed, cipherWords)
  return { cloakPhrase: fakeCloak, seedPhrase: fakeSeed, entropy: entropyHex }
}

export function validateCloak(cloakPhrase: string, cipherWords: string[]): CloakValidation {
  const cloakWords = cloakPhrase.trim().split(/\s+/)
  const cipherSet = new Set(cipherWords.map(w => w.toLowerCase()))
  let matchCount = 0
  cloakWords.forEach(word => { if (cipherSet.has(word.toLowerCase())) matchCount++ })
  return {
    isValid: matchCount === cloakWords.length && cloakWords.length > 0,
    matchCount,
    totalWords: cloakWords.length,
    confidence: Math.round((matchCount / cloakWords.length) * 100),
  }
}

// ── AES-256-GCM encrypt / decrypt ──

async function deriveKey(password: string, salt: Uint8Array, keyUsages: KeyUsage[]): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    keyUsages,
  )
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function exportCipherEncrypted(cipherWords: string[], password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, ['encrypt'])
  const plaintext = encoder.encode(JSON.stringify({ words: cipherWords }))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const envelope: EncryptedCipherV2 = {
    version: 2, salt: toBase64(salt), iv: toBase64(iv), encrypted: toBase64(new Uint8Array(ciphertext)),
  }
  return JSON.stringify(envelope)
}

export async function importCipherEncrypted(encryptedJson: string, password: string): Promise<string[]> {
  const data = JSON.parse(encryptedJson)
  if (data.version === 1) return importCipherV1(data, password)

  const salt = fromBase64(data.salt)
  const iv = fromBase64(data.iv)
  const ciphertext = fromBase64(data.encrypted)
  const key = await deriveKey(password, salt, ['decrypt'])
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  const decoded = new TextDecoder().decode(plaintext)
  const cipherData = JSON.parse(decoded) as { words: string[] }
  const validation = validateCipher(cipherData.words)
  if (!validation.isValid) throw new Error(`Decrypted cipher is invalid: ${validation.error}`)
  return cipherData.words
}

async function importCipherV1(data: { encrypted: string }, password: string): Promise<string[]> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password))
  const keyArray = new Uint8Array(hashBuffer)
  const encrypted = fromBase64(data.encrypted)
  const decrypted = new Uint8Array(encrypted.length)
  for (let i = 0; i < encrypted.length; i++) decrypted[i] = encrypted[i] ^ keyArray[i % keyArray.length]
  const cipherData = JSON.parse(new TextDecoder().decode(decrypted)) as { words: string[] }
  return cipherData.words
}
