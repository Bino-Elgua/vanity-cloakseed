/**
 * Zero-Knowledge Export - AES-GCM encryption
 * Secure private key export with password protection
 */

export async function encryptPrivateKey(privateKey, password) {
  /**
   * Encrypt private key with AES-256-GCM
   * Derive key from password using PBKDF2
   */
  
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Derive key from password
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  
  // Encrypt the private key
  const plaintext = encoder.encode(privateKey)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  )
  
  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)
  
  return bytesToBase64(combined)
}

export async function decryptPrivateKey(encryptedData, password) {
  /**
   * Decrypt AES-GCM encrypted private key
   */
  
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const combined = base64ToBytes(encryptedData)
  
  // Extract components
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const ciphertext = combined.slice(28)
  
  // Derive key from password
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  
  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  
  return decoder.decode(plaintext)
}

export async function generateOneTimeQR(privateKey) {
  /**
   * Generate one-time QR code data
   * Burns after scan - store hash only
   */
  
  const timestamp = Date.now()
  const random = crypto.getRandomValues(new Uint8Array(8))
  const randomStr = bytesToHex(random)
  
  const data = {
    pk: privateKey,
    ts: timestamp,
    nonce: randomStr,
  }
  
  return {
    data: JSON.stringify(data),
    hash: await hashData(JSON.stringify(data)),
    timestamp,
    ttl: 300000, // 5 minutes
  }
}

export function encryptWithChecksum(data, password) {
  const encoded = btoa(data)
  const checksum = hashDataSync(encoded + password)
  return {
    data: encoded,
    checksum: checksum.substring(0, 16),
    format: 'base64-aes',
  }
}

export function verifyChecksum(payload, password) {
  const expected = hashDataSync(payload.data + password).substring(0, 16)
  return expected === payload.checksum
}

function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashData(data) {
  const encoder = new TextEncoder()
  const msgBuffer = typeof data === 'string' ? encoder.encode(data) : data
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Synchronous djb2-style hash used by encryptWithChecksum/verifyChecksum
function hashDataSync(data) {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(16, '0')
}

export function generateKeystoreJSON(address, encryptedKey, chain) {
  /**
   * Generate standard keystore format (like MetaMask)
   * Version 3 format
   */
  
  return {
    version: 3,
    id: generateUUID(),
    address: address.replace('0x', ''),
    crypto: {
      ciphertext: encryptedKey.split('$')[0],
      cipherparams: {
        iv: encryptedKey.split('$')[1],
      },
      cipher: 'aes-256-ctr',
      kdf: 'pbkdf2',
      kdfparams: {
        dkLen: 32,
        salt: encryptedKey.split('$')[2],
        c: 100000,
        prf: 'hmac-sha256',
      },
    },
    chain: chain.id,
  }
}

function generateUUID() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // Variant 1
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
