/**
 * CloakSeed Cipher Engine
 * Maps custom 2048-word ciphers to BIP-39 indices
 */

import { sha256 } from '@noble/hashes/sha256';
import * as bip39 from 'bip39';

// Full 2048-word BIP-39 English wordlist from the bip39 package
const BIP39_WORDS = bip39.wordlists.EN;

/**
 * Validate that the BIP-39 wordlist is correctly loaded
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateBip39Wordlist() {
  if (!BIP39_WORDS || BIP39_WORDS.length !== 2048) {
    return { valid: false, error: `Expected 2048 BIP-39 words, got ${BIP39_WORDS?.length || 0}` };
  }
  // Checksum: verify known positions
  const checks = [
    [0, 'abandon'],
    [2047, 'zoo'],
    [1024, 'luxury'],
  ];
  for (const [idx, expected] of checks) {
    if (BIP39_WORDS[idx] !== expected) {
      return { valid: false, error: `Wordlist mismatch at index ${idx}: expected "${expected}", got "${BIP39_WORDS[idx]}"` };
    }
  }
  return { valid: true };
}

/**
 * Generate a custom cipher: map 2048 custom words to BIP-39 indices
 * @param {string[]} customWords - Array of 2048 unique custom words
 * @returns {Object} Cipher mapping: { word -> bip39Index }
 */
export function generateCipher(customWords) {
  if (customWords.length !== 2048) {
    throw new Error('Cipher must contain exactly 2048 words');
  }

  const uniqueWords = new Set(customWords);
  if (uniqueWords.size !== 2048) {
    throw new Error('All cipher words must be unique');
  }

  const cipherMap = {};
  customWords.forEach((word, index) => {
    cipherMap[word.toLowerCase()] = index; // Index 0-2047 maps to BIP-39 index
  });

  return cipherMap;
}

/**
 * Create a cipher from a theme + user customizations
 * @param {string[]} themeWords - Base theme words (2048)
 * @param {Object} customizations - User edits: { oldWord: newWord, ... }
 * @returns {Object} Final cipher mapping
 */
export function generateCipherFromTheme(themeWords, customizations = {}) {
  const cipher = [...themeWords]; // Clone theme

  // Apply customizations
  Object.entries(customizations).forEach(([oldWord, newWord]) => {
    const index = cipher.indexOf(oldWord);
    if (index !== -1) {
      cipher[index] = newWord;
    }
  });

  return generateCipher(cipher);
}

/**
 * Encode a BIP-39 phrase using custom cipher
 * Input: "abandon able zone" (real BIP-39 words)
 * Output: "fluff spark moon" (custom cipher words)
 *
 * @param {string} bip39Phrase - Standard 12 or 24-word BIP-39 phrase
 * @param {string[]} cipherWords - Custom cipher words (2048)
 * @returns {string} Encoded cloak phrase
 */
export function encodePhrase(bip39Phrase, cipherWords) {
  if (!bip39.validateMnemonic(bip39Phrase.trim())) {
    throw new Error('Invalid BIP-39 mnemonic phrase');
  }
  if (!cipherWords || cipherWords.length !== 2048) {
    throw new Error('Cipher must contain exactly 2048 words');
  }

  const phraseWords = bip39Phrase.trim().split(/\s+/);

  return phraseWords
    .map(word => {
      const index = BIP39_WORDS.indexOf(word.toLowerCase());
      if (index === -1) {
        throw new Error(`Word "${word}" is not in the BIP-39 wordlist`);
      }
      return cipherWords[index];
    })
    .join(' ');
}

/**
 * Decode a cloak phrase back to real BIP-39
 * Input: "fluff spark moon" (cloak)
 * Output: "abandon able zone" (real BIP-39)
 *
 * @param {string} cloakPhrase - Custom cipher phrase
 * @param {string[]} cipherWords - Custom cipher words (2048)
 * @returns {string} Real BIP-39 phrase
 */
export function decodePhrase(cloakPhrase, cipherWords) {
  if (!cipherWords || cipherWords.length !== 2048) {
    throw new Error('Cipher must contain exactly 2048 words');
  }

  const cloakWords = cloakPhrase.trim().split(/\s+/);
  const cipherLookup = new Map(cipherWords.map((w, i) => [w.toLowerCase(), i]));

  const decoded = cloakWords
    .map(word => {
      const index = cipherLookup.get(word.toLowerCase());
      if (index === undefined) {
        throw new Error(`Invalid cloak word: "${word}" not found in cipher`);
      }
      if (index >= BIP39_WORDS.length) {
        throw new Error(`Cipher index ${index} out of BIP-39 range`);
      }
      return BIP39_WORDS[index];
    })
    .join(' ');

  if (!bip39.validateMnemonic(decoded)) {
    throw new Error('Decoded phrase failed BIP-39 checksum validation');
  }

  return decoded;
}

/**
 * Validate a cipher
 * @param {string[]} cipherWords - Words to validate (should be 2048)
 * @returns {Object} { isValid: bool, error?: string }
 */
export function validateCipher(cipherWords) {
  if (!Array.isArray(cipherWords)) {
    return { isValid: false, error: 'Cipher must be an array' };
  }

  if (cipherWords.length !== 2048) {
    return { isValid: false, error: `Cipher must have exactly 2048 words, got ${cipherWords.length}` };
  }

  const uniqueWords = new Set(cipherWords.map(w => w.toLowerCase()));
  if (uniqueWords.size !== 2048) {
    return { isValid: false, error: 'All cipher words must be unique' };
  }

  // Check for empty/invalid words
  if (cipherWords.some(w => !w || typeof w !== 'string' || w.trim() === '')) {
    return { isValid: false, error: 'Cipher contains invalid or empty words' };
  }

  // Enforce max word length
  const tooLong = cipherWords.find(w => w.length > 50)
  if (tooLong) {
    return { isValid: false, error: `Cipher word exceeds 50 character limit: "${tooLong.slice(0, 20)}..."` }
  }

  return { isValid: true };
}

/**
 * Hash a cipher for fingerprinting
 * @param {string[]} cipherWords - Cipher to hash
 * @returns {string} Hex-encoded SHA256 hash
 */
export function hashCipher(cipherWords) {
  const cipherString = cipherWords.join('|');
  const hash = sha256(cipherString);
  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a "panic phrase" - a fake cloak using a different seed
 * User types this fake phrase, app shows a worthless wallet
 * Real wallet stays hidden until real cloak is entered
 * 
 * @param {string[]} cipherWords - Custom cipher
 * @param {string} panicInput - User's panic phrase (fake words)
 * @returns {Object} { cloakPhrase: string, seedPhrase: string, entropy: string }
 */
export function generatePanicPhrase(cipherWords, panicInput = '') {
  // Generate a valid BIP-39 mnemonic (12 words = 128-bit entropy)
  const entropy = crypto.getRandomValues(new Uint8Array(16)); // 128 bits
  const fakeSeed = bip39.entropyToMnemonic(
    Array.from(entropy).map(b => b.toString(16).padStart(2, '0')).join('')
  );

  // Encode the valid fake seed with cipher
  const fakeCloak = encodePhrase(fakeSeed, cipherWords);

  return {
    cloakPhrase: fakeCloak,
    seedPhrase: fakeSeed,
    entropy: Array.from(entropy).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

/**
 * Check if a phrase matches a cipher
 * (Verify user entered correct cloak words)
 * 
 * @param {string} cloakPhrase - User's entered phrase
 * @param {string[]} cipherWords - Known cipher
 * @returns {Object} { isValid: bool, matchCount: number, totalWords: number }
 */
export function validateCloak(cloakPhrase, cipherWords) {
  const cloakWords = cloakPhrase.trim().split(/\s+/);
  const cipherSet = new Set(cipherWords.map(w => w.toLowerCase()));

  let matchCount = 0;
  cloakWords.forEach(word => {
    if (cipherSet.has(word.toLowerCase())) {
      matchCount++;
    }
  });

  return {
    isValid: matchCount === cloakWords.length && cloakWords.length > 0,
    matchCount,
    totalWords: cloakWords.length,
    confidence: Math.round((matchCount / cloakWords.length) * 100)
  };
}

/**
 * Derive an AES-256-GCM key from a password using PBKDF2
 * @param {string} password
 * @param {Uint8Array} salt
 * @param {string[]} keyUsages - ['encrypt'] or ['decrypt']
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt, keyUsages) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    keyUsages
  );
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Export cipher as AES-256-GCM encrypted JSON
 * @param {string[]} cipherWords - Cipher to export
 * @param {string} password - Password for encryption
 * @returns {Promise<string>} Encrypted JSON string
 */
export async function exportCipherEncrypted(cipherWords, password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, salt, ['encrypt']);

  const plaintext = encoder.encode(JSON.stringify({ words: cipherWords }));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return JSON.stringify({
    version: 2,
    salt: toBase64(salt),
    iv: toBase64(iv),
    encrypted: toBase64(new Uint8Array(ciphertext)),
  });
}

/**
 * Import encrypted cipher JSON (supports v1 migration and v2)
 * @param {string} encryptedJson - Encrypted JSON string
 * @param {string} password - Password for decryption
 * @returns {Promise<string[]>} Decrypted cipher words
 */
export async function importCipherEncrypted(encryptedJson, password) {
  const data = JSON.parse(encryptedJson);

  // v1 migration: legacy XOR format
  if (data.version === 1) {
    return importCipherV1(data, password);
  }

  // v2: AES-256-GCM
  const salt = fromBase64(data.salt);
  const iv = fromBase64(data.iv);
  const ciphertext = fromBase64(data.encrypted);

  const key = await deriveKey(password, salt, ['decrypt']);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoded = new TextDecoder().decode(plaintext);
  const cipherData = JSON.parse(decoded);

  const words = cipherData.words;
  const validation = validateCipher(words);
  if (!validation.isValid) {
    throw new Error(`Decrypted cipher is invalid: ${validation.error}`);
  }

  return words;
}

/**
 * Migration path for v1 (XOR) encrypted ciphers
 * @param {Object} data - Parsed v1 JSON envelope
 * @param {string} password
 * @returns {Promise<string[]>}
 */
async function importCipherV1(data, password) {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const keyArray = new Uint8Array(hashBuffer);

  const encrypted = fromBase64(data.encrypted);
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyArray[i % keyArray.length];
  }

  const decryptedString = new TextDecoder().decode(decrypted);
  const cipherData = JSON.parse(decryptedString);
  return cipherData.words;
}
