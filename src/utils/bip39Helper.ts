import * as bip39 from 'bip39'
import * as bip32 from 'bip32'
import { Wallet } from 'ethers'
import { payments, networks } from 'bitcoinjs-lib'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import type { DerivedWallet, MultiChainWallets } from './types'

const BIP39_WORDLIST: string[] = bip39.wordlists.EN

interface SeedResult {
  entropy: string
  seedPhrase: string
  wordCount: number
}

export function generateRandomSeed(wordCount: number = 12): SeedResult {
  const byteLength = (wordCount * 11 - 11) / 8
  const entropy = crypto.getRandomValues(new Uint8Array(byteLength))
  const seedPhrase = bip39.entropyToMnemonic(
    Array.from(entropy).map(b => b.toString(16).padStart(2, '0')).join('')
  )
  return {
    entropy: Array.from(entropy).map(b => b.toString(16).padStart(2, '0')).join(''),
    seedPhrase,
    wordCount,
  }
}

export function validateSeedPhrase(phrase: string): boolean {
  if (!phrase || typeof phrase !== 'string') return false
  const words = phrase.trim().split(/\s+/)
  if (![12, 15, 18, 21, 24].includes(words.length)) return false
  return bip39.validateMnemonic(phrase.trim())
}

export function deriveEthereumWallet(seedPhrase: string): DerivedWallet {
  const wallet = Wallet.fromPhrase(seedPhrase)
  return {
    address: wallet.address,
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey,
    derivationPath: "m/44'/60'/0'/0/0",
    mnemonic: seedPhrase,
  }
}

export function deriveBitcoinWallet(seedPhrase: string): DerivedWallet {
  const seed = bip39.mnemonicToSeedSync(seedPhrase)
  const node = bip32.BIP32.fromSeed(seed, networks.bitcoin)
  const derived = node.derivePath("m/44'/0'/0'/0/0")
  const { address } = payments.p2pkh({ pubkey: derived.publicKey })
  return {
    address: address!,
    publicKey: derived.publicKey.toString('hex'),
    derivationPath: "m/44'/0'/0'/0/0",
  }
}

export function deriveSolanaWallet(seedPhrase: string): DerivedWallet {
  const seed = bip39.mnemonicToSeedSync(seedPhrase)
  const node = bip32.BIP32.fromSeed(seed, networks.bitcoin)
  const derived = node.derivePath("m/44'/501'/0'/0'/0'")
  const secretKey = derived.privateKey!
  const keypair = nacl.sign.keyPair.fromSecretKey(secretKey)
  const address = bs58.encode(keypair.publicKey)
  return {
    address,
    publicKey: Array.from(keypair.publicKey).map(b => b.toString(16).padStart(2, '0')).join(''),
    derivationPath: "m/44'/501'/0'/0'/0'",
  }
}

export function getAllAddresses(seedPhrase: string): MultiChainWallets {
  return {
    ethereum: deriveEthereumWallet(seedPhrase),
    bitcoin: deriveBitcoinWallet(seedPhrase),
    solana: deriveSolanaWallet(seedPhrase),
  }
}

export function isValidBip39Word(word: string): boolean {
  return BIP39_WORDLIST.includes(word.toLowerCase())
}

export function getBip39Wordlist(): string[] {
  return BIP39_WORDLIST
}

export function suggestWords(prefix: string, limit: number = 5): string[] {
  const lower = prefix.toLowerCase()
  return BIP39_WORDLIST.filter(w => w.startsWith(lower)).slice(0, limit)
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
  suggestWords,
}
