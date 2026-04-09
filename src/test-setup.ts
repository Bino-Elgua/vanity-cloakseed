import { sha512 } from '@noble/hashes/sha512'
import * as ed25519 from '@noble/ed25519'

// @noble/ed25519 requires sha512Sync on the `etc` object for sync key operations
ed25519.etc.sha512Sync = (...m: Uint8Array[]) => sha512(...m)
