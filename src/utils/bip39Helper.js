/**
 * BIP-39 Helper: Full wallet derivation + multi-chain support
 * Standard BIP-39 English wordlist + BIP-32/44 hierarchy
 */

import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import { Wallet, HDNodeWallet } from 'ethers';
import { payments, networks } from 'bitcoinjs-lib';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Use the canonical BIP-39 English wordlist from the bip39 package
const BIP39_WORDLIST = bip39.wordlists.EN;

/**
 * Generate random entropy + BIP-39 seed phrase
 * @param {number} wordCount - 12, 15, 18, 21, or 24 words
 * @returns {Object} { entropy, seedPhrase, entropy }
 */
export function generateRandomSeed(wordCount = 12) {
  // BIP-39: 12 words = 128 bits, 24 words = 256 bits
  const byteLength = (wordCount * 11 - 11) / 8;
  const entropy = crypto.getRandomValues(new Uint8Array(byteLength));
  const seedPhrase = bip39.entropyToMnemonic(
    Array.from(entropy).map(b => b.toString(16).padStart(2, '0')).join('')
  );
  
  return {
    entropy: Array.from(entropy).map(b => b.toString(16).padStart(2, '0')).join(''),
    seedPhrase,
    wordCount
  };
}

/**
 * Validate BIP-39 phrase (includes checksum verification)
 */
export function validateSeedPhrase(phrase) {
  if (!phrase || typeof phrase !== 'string') return false;
  const words = phrase.trim().split(/\s+/);
  if (![12, 15, 18, 21, 24].includes(words.length)) return false;
  // bip39.validateMnemonic checks both wordlist membership AND checksum
  return bip39.validateMnemonic(phrase.trim());
}

/**
 * Derive Ethereum wallet from seed phrase (BIP-44 m/44'/60'/0'/0/0)
 */
export function deriveEthereumWallet(seedPhrase) {
  try {
    const wallet = Wallet.fromPhrase(seedPhrase);
    return {
      address: wallet.address,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic
    };
  } catch (err) {
    throw new Error(`Invalid seed phrase: ${err.message}`);
  }
}

/**
 * Derive Bitcoin wallet (BIP-44 m/44'/0'/0'/0/0)
 */
export function deriveBitcoinWallet(seedPhrase) {
  try {
    const seed = bip39.mnemonicToSeedSync(seedPhrase);
    const node = bip32.BIP32.fromSeed(seed, networks.bitcoin);
    
    // BIP-44 derivation path for Bitcoin
    const derived = node
      .derivePath("m/44'/0'/0'/0/0");
    
    const { address } = payments.p2pkh({ pubkey: derived.publicKey });
    
    return {
      address,
      publicKey: derived.publicKey.toString('hex'),
      derivationPath: "m/44'/0'/0'/0/0"
    };
  } catch (err) {
    throw new Error(`Bitcoin derivation failed: ${err.message}`);
  }
}

/**
 * Derive Solana wallet (BIP-44 m/44'/501'/0'/0'/0')
 */
export function deriveSolanaWallet(seedPhrase) {
  try {
    const seed = bip39.mnemonicToSeedSync(seedPhrase);
    const node = bip32.BIP32.fromSeed(seed, networks.bitcoin);
    
    // BIP-44 derivation path for Solana
    const derived = node.derivePath("m/44'/501'/0'/0'/0'");

    // Solana uses Ed25519, not ECDSA
    const secretKey = derived.privateKey;
    const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);

    // Base58 encode Solana address
    const address = bs58.encode(keypair.publicKey);

    return {
      address,
      publicKey: Array.from(keypair.publicKey).map(b => b.toString(16).padStart(2, '0')).join(''),
      derivationPath: "m/44'/501'/0'/0'/0'"
    };
  } catch (err) {
    throw new Error(`Solana derivation failed: ${err.message}`);
  }
}

/**
 * Get all addresses from seed phrase
 */
export function getAllAddresses(seedPhrase) {
  return {
    ethereum: deriveEthereumWallet(seedPhrase),
    bitcoin: deriveBitcoinWallet(seedPhrase),
    solana: deriveSolanaWallet(seedPhrase)
  };
}

/**
 * Verify word is in BIP-39 list
 */
export function isValidBip39Word(word) {
  return BIP39_WORDLIST.includes(word.toLowerCase());
}

/**
 * Get BIP-39 wordlist
 */
export function getBip39Wordlist() {
  return BIP39_WORDLIST;
}

/**
 * Suggest completions for word prefix
 */
export function suggestWords(prefix, limit = 5) {
  const lower = prefix.toLowerCase();
  return BIP39_WORDLIST
    .filter(w => w.startsWith(lower))
    .slice(0, limit);
}

export default {
  generateRandomSeed,
  validateSeedPhrase,
  deriveEthereumWallet,
  deriveBitcoinWallet,
  deriveSolanaWallet,
  getAllAddresses,
  isValidBip39Word,
  getBip39Wordlist,
  suggestWords
};
