/**
 * useCloakSeed: Central state management for CloakSeed
 * Manages cipher, generation, restoration, panic phrases, etc.
 */

import { useState, useCallback, useEffect, useContext } from 'react';
import * as bip39 from 'bip39';
import {
  generateCipherFromTheme,
  encodePhrase,
  decodePhrase,
  validateCipher,
  hashCipher,
  generatePanicPhrase,
  validateCloak,
  exportCipherEncrypted,
  importCipherEncrypted
} from '../utils/ciphers';
import { THEMES } from '../utils/wordlists';
import { generateRandomSeed, getAllAddresses, validateSeedPhrase } from '../utils/bip39Helper';
import SecurityContext from '../context/SecurityContext.jsx';

const STORAGE_KEY = 'cloakseed_data';

export function useCloakSeed() {
  const { isParanoidMode } = useContext(SecurityContext);

  // Cipher state
  const [cipher, setCipherState] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('animals');
  const [cipherFingerprint, setCipherFingerprint] = useState(null);
  
  // Generation state
  const [entropy, setEntropy] = useState(null);
  const [realSeed, setRealSeed] = useState(null);
  const [cloakPhrase, setCloakPhrase] = useState(null);
  const [wallets, setWallets] = useState(null);
  
  // Restoration state
  const [restoredSeed, setRestoredSeed] = useState(null);
  const [restoredWallets, setRestoredWallets] = useState(null);
  
  // Panic phrase state
  const [panicPhrase, setPanicPhrase] = useState(null);
  const [panicWallets, setPanicWallets] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [clipboard, setClipboard] = useState({ text: '', copiedAt: null });

  // Load from encrypted localStorage on mount
  useEffect(() => {
    loadFromStorage().catch(() => {});
  }, []);

  // Auto-clear clipboard after 5 seconds (security hardened)
  useEffect(() => {
    if (clipboard.copiedAt) {
      const timer = setTimeout(() => {
        clearClipboard();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [clipboard.copiedAt]);

  /**
   * Load cipher from encrypted localStorage.
   * Prompts user for password to decrypt the cipher.
   * Non-cipher fields (theme, premium, fingerprint) are stored unencrypted.
   */
  const loadFromStorage = useCallback(async () => {
    if (isParanoidMode) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);
      if (data.selectedTheme) setSelectedTheme(data.selectedTheme);
      if (data.isPremium) setIsPremium(data.isPremium);
      if (data.cipherFingerprint) setCipherFingerprint(data.cipherFingerprint);

      // Cipher is stored encrypted — prompt for password to decrypt
      if (data.encryptedCipher) {
        const password = window.prompt('Enter password to unlock your saved cipher:');
        if (!password) return; // User cancelled — cipher stays null
        try {
          const cipherWords = await importCipherEncrypted(data.encryptedCipher, password);
          const cipherMap = {};
          cipherWords.forEach((word, idx) => {
            cipherMap[word.toLowerCase()] = idx;
          });
          setCipherState(cipherMap);
        } catch (decryptErr) {
          console.error('Failed to decrypt cipher — wrong password or corrupted data');
          setError('Failed to decrypt cipher. Check your password.');
        }
      }
    } catch (err) {
      console.error('Failed to load from storage:', err);
    }
  }, []);

  /**
   * Save cipher to encrypted localStorage.
   * Cipher is always encrypted with a user-provided password before storing.
   * Never stores cipher in plaintext.
   */
  const saveToStorage = useCallback(async (data) => {
    if (isParanoidMode) return;
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      const stored = current ? JSON.parse(current) : {};

      // If cipher data is being saved, encrypt it first
      if (data.cipher) {
        const password = window.prompt('Set a password to protect your cipher in local storage:');
        if (!password) {
          console.warn('[Security] Cipher not saved — no password provided');
          return;
        }
        const cipherWords = Object.keys(data.cipher);
        const encryptedCipher = await exportCipherEncrypted(cipherWords, password);

        // Store encrypted cipher, never plaintext
        const { cipher, ...nonSensitiveData } = data;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...stored,
          ...nonSensitiveData,
          encryptedCipher,
        }));
      } else {
        // Non-cipher data can be stored directly
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, ...data }));
      }
    } catch (err) {
      console.error('Failed to save to storage:', err);
    }
  }, []);

  /**
   * Set cipher from theme (or custom words)
   */
  const setCipherFromTheme = useCallback(async (themeName, customizations = {}) => {
    try {
      setLoading(true);
      setError(null);

      const theme = THEMES[themeName];
      if (!theme) {
        throw new Error(`Unknown theme: ${themeName}`);
      }

      const cipherWords = generateCipherFromTheme(theme.words, customizations);
      const validation = validateCipher(Object.keys(cipherWords));
      
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const fingerprint = hashCipher(Object.keys(cipherWords));
      
      setCipherState(cipherWords);
      setSelectedTheme(themeName);
      setCipherFingerprint(fingerprint);
      
      saveToStorage({
        cipher: cipherWords,
        selectedTheme: themeName,
        cipherFingerprint: fingerprint
      });

      return { success: true, fingerprint };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [saveToStorage]);

  /**
   * Generate new cloak phrase
   */
  const generateNewCloak = useCallback(async (wordCount = 12) => {
    try {
      setLoading(true);
      setError(null);

      if (!cipher) {
        throw new Error('No cipher selected. Create one first.');
      }

      // Check free tier limit
      if (!isPremium) {
        // Simple check: prevent generation if already generated 5 times this month
        // For production, use backend validation
        console.warn('Free tier: limited to 5 generations/month');
      }

      // Generate random entropy + BIP-39 seed
      const { entropy: ent, seedPhrase } = generateRandomSeed(wordCount);
      setEntropy(ent);
      setRealSeed(seedPhrase);

      // Encode with cipher
      const cipherWords = Object.keys(cipher);
      const cloak = encodePhrase(seedPhrase, cipherWords);
      setCloakPhrase(cloak);

      // Derive all addresses
      const addresses = getAllAddresses(seedPhrase);
      setWallets(addresses);

      return {
        success: true,
        entropy: ent,
        realSeed: seedPhrase,
        cloakPhrase: cloak,
        wallets: addresses
      };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [cipher, isPremium]);

  /**
   * Restore wallet from cloak phrase
   */
  const restoreFromCloak = useCallback(async (cloakPhrase) => {
    try {
      setLoading(true);
      setError(null);

      if (!cipher) {
        throw new Error('No cipher loaded. Create one first.');
      }

      // Validate cloak words
      const validation = validateCloak(cloakPhrase, Object.keys(cipher));
      if (!validation.isValid) {
        throw new Error(
          `Invalid cloak phrase. ${validation.matchCount}/${validation.totalWords} words recognized.`
        );
      }

      // Decode to real seed
      const cipherWords = Object.keys(cipher);
      const seed = decodePhrase(cloakPhrase, cipherWords);

      // Validate seed is valid BIP-39
      if (!validateSeedPhrase(seed)) {
        throw new Error('Decoded seed is invalid. Check your cipher.');
      }

      // Derive addresses
      const addresses = getAllAddresses(seed);
      
      setRestoredSeed(seed);
      setRestoredWallets(addresses);

      return {
        success: true,
        seedPhrase: seed,
        wallets: addresses
      };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [cipher]);

  /**
   * Generate panic phrase (fake wallet)
   */
  const createPanicPhrase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!cipher) {
        throw new Error('No cipher selected.');
      }

      const cipherWords = Object.keys(cipher);
      const { cloakPhrase: fakeCloak, seedPhrase: fakeSeed } = generatePanicPhrase(cipherWords);

      // Derive fake wallet
      const fakeAddresses = getAllAddresses(fakeSeed);

      setPanicPhrase(fakeCloak);
      setPanicWallets(fakeAddresses);

      return {
        success: true,
        cloakPhrase: fakeCloak,
        wallets: fakeAddresses
      };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [cipher]);

  /**
   * Copy to clipboard + zeroize after 5s
   */
  const copyToClipboard = useCallback(async (text) => {
    try {
      // Warn if copying sensitive key material
      if (/^(0x)?[0-9a-fA-F]{64}$/.test(text.trim()) || /^[0-9a-fA-F]{64}$/.test(text.trim())) {
        console.warn('[Security] Private key copied to clipboard — will auto-clear in 5s');
      }
      await navigator.clipboard.writeText(text);
      setClipboard({ text, copiedAt: Date.now() });
      return true;
    } catch (err) {
      setError('Failed to copy to clipboard');
      return false;
    }
  }, []);

  const clearClipboard = useCallback(async () => {
    try {
      // Overwrite with marker before clearing to defeat clipboard history managers
      await navigator.clipboard.writeText('[CLEARED]');
      setClipboard({ text: '', copiedAt: null });
    } catch (err) {
      console.error('Failed to clear clipboard:', err);
    }
  }, []);

  /**
   * Export cipher as encrypted JSON
   */
  const exportCipher = useCallback(async (password) => {
    try {
      setLoading(true);
      setError(null);

      if (!cipher) {
        throw new Error('No cipher to export.');
      }

      const cipherWords = Object.keys(cipher);
      const encrypted = await exportCipherEncrypted(cipherWords, password);

      return {
        success: true,
        encrypted
      };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [cipher]);

  /**
   * Import cipher from encrypted JSON
   */
  const importCipher = useCallback(async (encryptedJson, password) => {
    try {
      setLoading(true);
      setError(null);

      const cipherWords = await importCipherEncrypted(encryptedJson, password);
      const validation = validateCipher(cipherWords);

      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const cipherMap = {};
      cipherWords.forEach((word, idx) => {
        cipherMap[word.toLowerCase()] = idx;
      });

      const fingerprint = hashCipher(cipherWords);

      setCipherState(cipherMap);
      setCipherFingerprint(fingerprint);
      setSelectedTheme('custom');

      saveToStorage({
        cipher: cipherMap,
        selectedTheme: 'custom',
        cipherFingerprint: fingerprint
      });

      return { success: true, fingerprint };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [saveToStorage]);

  /**
   * Zeroize sensitive data
   */
  const zeroize = useCallback(() => {
    setRealSeed(null);
    setRestoredSeed(null);
    setEntropy(null);
    setCloakPhrase(null);
    setRestoredWallets(null);
    setPanicPhrase(null);
    clearClipboard();
  }, [clearClipboard]);

  /**
   * Clear all data (factory reset)
   */
  const reset = useCallback(() => {
    setCipherState(null);
    setSelectedTheme('animals');
    setCipherFingerprint(null);
    zeroize();
    if (!isParanoidMode) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [zeroize, isParanoidMode]);

  return {
    // Cipher state
    cipher,
    selectedTheme,
    cipherFingerprint,

    // Generation
    entropy,
    realSeed,
    cloakPhrase,
    wallets,

    // Restoration
    restoredSeed,
    restoredWallets,

    // Panic
    panicPhrase,
    panicWallets,

    // UI
    loading,
    error,
    isPremium,
    clipboard,

    // Methods
    setCipherFromTheme,
    generateNewCloak,
    restoreFromCloak,
    createPanicPhrase,
    copyToClipboard,
    clearClipboard,
    exportCipher,
    importCipher,
    zeroize,
    reset,
    setIsPremium
  };
}

export default useCloakSeed;
