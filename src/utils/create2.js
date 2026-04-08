import { keccak_256 } from '@noble/hashes/sha3'
import { toChecksumAddress } from './crypto'

/**
 * Helper: Convert hex string to Uint8Array
 */
function hexToBytes(hex) {
  const h = hex.replace('0x', '')
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < h.length; i += 2) {
    bytes[i / 2] = parseInt(h.substr(i, 2), 16)
  }
  return bytes
}

/**
 * Helper: Convert Uint8Array to hex string
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Helper: Concatenate Uint8Arrays
 */
function concatBytes(...arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/**
 * Calculate CREATE2 address
 * Formula: keccak256(0xff ++ address ++ salt ++ keccak256(bytecode))
 * @param {string} deployer - Deployer address (0x...)
 * @param {string} salt - 32-byte salt (0x... or plain hex)
 * @param {string} bytecode - Contract bytecode (0x... or plain hex)
 * @returns {string} Predicted contract address
 */
export function calculateCreate2Address(deployer, salt, bytecode) {
  try {
    // Validate bytecode size (max 25KB = 25600 bytes = 51200 hex chars)
    const bytecodeHex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode
    if (bytecodeHex.length > 51200) {
      throw new Error('Bytecode exceeds 25KB limit')
    }

    // Normalize inputs
    const deployerBytes = hexToBytes(deployer.slice(2))
    const saltBytes = normalizeBytesInput(salt, 32)
    const bytecodeBytes = normalizeBytesInput(bytecode)

    // Calculate init code hash
    const initCodeHash = keccak_256(bytecodeBytes)

    // Construct the hash input: 0xff ++ deployer ++ salt ++ initCodeHash
    const input = concatBytes(
      new Uint8Array([0xff]),
      deployerBytes,
      saltBytes,
      initCodeHash,
    )

    // Hash the input
    const address = bytesToHex(keccak_256(input))

    // Take last 20 bytes and add 0x prefix
    return toChecksumAddress('0x' + address.slice(-40))
  } catch (error) {
    throw new Error(`Failed to calculate CREATE2 address: ${error.message}`)
  }
}

/**
 * Find a vanity salt for CREATE2
 * @param {string} deployer - Deployer address
 * @param {string} bytecode - Contract bytecode
 * @param {string} pattern - Pattern to match (prefix or suffix)
 * @param {number} maxAttempts - Maximum attempts
 * @returns {Promise<Object>} { salt, address, attempts }
 */
export async function findVanitySalt(deployer, bytecode, pattern, maxAttempts = 1000000) {
  const patternLower = pattern.toLowerCase()

  // Validate bytecode size (max 25KB)
  const bytecodeHex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode
  if (bytecodeHex.length > 51200) {
    throw new Error('Bytecode exceeds 25KB limit')
  }

  let attempts = 0

  while (attempts < maxAttempts) {
    // Generate random salt
    const saltBytes = crypto.getRandomValues(new Uint8Array(32))
    const salt = '0x' + Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')

    try {
      const address = calculateCreate2Address(deployer, salt, bytecode)
      const addressLower = address.slice(2).toLowerCase()

      // Check if matches pattern
      if (addressLower.includes(patternLower)) {
        return {
          salt,
          address,
          attempts,
        }
      }
    } catch (e) {
      // Skip invalid configurations
    }

    attempts++

    // Yield to UI every 10k attempts
    if (attempts % 10000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  throw new Error(`Failed to find vanity salt after ${maxAttempts} attempts`)
}

/**
 * Calculate CREATE address (traditional deployment)
 * Formula: keccak256(rlp(address, nonce))
 * @param {string} deployer - Deployer address
 * @param {string} nonce - Account nonce (0-based)
 * @returns {string} Predicted contract address
 */
export function calculateCreateAddress(deployer, nonce) {
  try {
    const deployerBytes = Buffer.from(deployer.slice(2), 'hex')
    const nonceNum = parseInt(nonce)

    // RLP encode [address, nonce]
    // For nonce 0: 0xc0 (empty list)
    // For nonce 1-127: single byte
    // For nonce > 127: length-prefixed
    let nonceRlp
    if (nonceNum === 0) {
      nonceRlp = Buffer.from([0x80]) // RLP of 0
    } else if (nonceNum < 128) {
      nonceRlp = Buffer.from([nonceNum]) // Single byte
    } else {
      // Multi-byte encoding
      const nonceHex = nonceNum.toString(16)
      const nonceBytes = Buffer.from(nonceHex.padStart(nonceHex.length % 2 ? nonceHex.length + 1 : nonceHex.length, '0'), 'hex')
      nonceRlp = Buffer.concat([Buffer.from([0x80 + nonceBytes.length]), nonceBytes])
    }

    // RLP encode address (always 20 bytes, length-prefixed)
    const addressRlp = Buffer.concat([Buffer.from([0x94]), deployerBytes])

    // Combine into list
    const combined = Buffer.concat([addressRlp, nonceRlp])
    let rlpEncoded

    if (combined.length < 56) {
      rlpEncoded = Buffer.concat([Buffer.from([0xc0 + combined.length]), combined])
    } else {
      const lengthHex = combined.length.toString(16)
      const lengthBytes = Buffer.from(lengthHex.padStart(lengthHex.length % 2 ? lengthHex.length + 1 : lengthHex.length, '0'), 'hex')
      rlpEncoded = Buffer.concat([Buffer.from([0xf7 + lengthBytes.length]), lengthBytes, combined])
    }

    // Hash and take last 20 bytes
    const hash = keccak_256(rlpEncoded)
    const address = '0x' + Buffer.from(hash).toString('hex').slice(-40)

    return toChecksumAddress(address)
  } catch (error) {
    throw new Error(`Failed to calculate CREATE address: ${error.message}`)
  }
}

/**
 * Normalize input bytes (handles both 0x prefix and plain hex)
 * @param {string} input
 * @param {number} expectedLength - Expected length in bytes (optional)
 * @returns {Uint8Array}
 */
function normalizeBytesInput(input, expectedLength = null) {
  const hex = input.startsWith('0x') ? input.slice(2) : input
  
  // Pad with zeros if needed
  let padded = hex
  if (expectedLength && hex.length < expectedLength * 2) {
    padded = hex.padStart(expectedLength * 2, '0')
  }

  return hexToBytes(padded)
}

/**
 * Generate sample bytecode for testing
 * @returns {string} Simple contract bytecode
 */
export function getSampleBytecode() {
  // Simple contract: contract Empty {}
  return '0x60806040523660003760006000f3'
}
