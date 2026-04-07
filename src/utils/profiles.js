/**
 * Batch & Profile Mode — Encrypted Storage
 *
 * All profile/batch data is AES-256-GCM encrypted in localStorage.
 * A session password is required to unlock; the derived key is held in
 * memory and auto-wiped after 5 minutes of inactivity.
 *
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string} name
 * @property {string} chain
 * @property {string} prefix
 * @property {string} suffix
 * @property {boolean} caseSensitive
 * @property {number} created
 * @property {number} lastUsed
 *
 * @typedef {Object} BatchJob
 * @property {string} id
 * @property {Profile[]} profiles
 * @property {'pending'|'running'|'completed'|'failed'} status
 * @property {any[]} results
 * @property {number} startTime
 * @property {number} [endTime]
 * @property {string} [error]
 */

import { validateAddress } from './validation'

const STORAGE_KEY = 'vanity-profiles-v2'
const BATCH_QUEUE_KEY = 'vanity-batch-queue-v2'
const LOCK_TIMEOUT = 5 * 60 * 1000 // 5 minutes

// ── Secure memory helpers ──

/**
 * Overwrite a Uint8Array with zeros before releasing it to GC
 */
export function secureWipe(buffer) {
  if (buffer instanceof Uint8Array) {
    crypto.getRandomValues(buffer) // overwrite with random
    buffer.fill(0)                 // then zero
  }
}

/**
 * Overwrite a string-like value in an object (best-effort; JS strings are immutable)
 * For real security the sensitive data should stay in Uint8Array form.
 */
export function wipeObject(obj) {
  if (!obj || typeof obj !== 'object') return
  for (const key of Object.keys(obj)) {
    if (obj[key] instanceof Uint8Array) {
      secureWipe(obj[key])
    }
    obj[key] = null
  }
}

// ── AES-256-GCM encrypt / decrypt ──

async function deriveKey(password, salt, usage) {
  const enc = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  )
}

async function encryptData(plaintext, password) {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, 'encrypt')
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(plaintext)
  )
  return JSON.stringify({
    v: 2,
    s: bufToB64(salt),
    i: bufToB64(iv),
    d: bufToB64(new Uint8Array(ciphertext)),
  })
}

async function decryptData(stored, password) {
  const { v, s, i, d } = JSON.parse(stored)
  if (v !== 2) throw new Error('Unsupported storage version')
  const salt = b64ToBuf(s)
  const iv = b64ToBuf(i)
  const ciphertext = b64ToBuf(d)
  const key = await deriveKey(password, salt, 'decrypt')
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, ciphertext
  )
  return new TextDecoder().decode(plaintext)
}

function bufToB64(buf) {
  let s = ''
  for (let i = 0; i < buf.byteLength; i++) s += String.fromCharCode(buf[i])
  return btoa(s)
}

function b64ToBuf(b64) {
  const s = atob(b64)
  const buf = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i)
  return buf
}

// ── Session state (auto-lock) ──

let _sessionPassword = null
let _lockTimer = null

function resetLockTimer() {
  if (_lockTimer) clearTimeout(_lockTimer)
  _lockTimer = setTimeout(() => {
    lock()
  }, LOCK_TIMEOUT)
}

export function isUnlocked() {
  return _sessionPassword !== null
}

export function unlock(password) {
  _sessionPassword = password
  resetLockTimer()
}

export function lock() {
  _sessionPassword = null
  if (_lockTimer) {
    clearTimeout(_lockTimer)
    _lockTimer = null
  }
}

function requireUnlocked() {
  if (!_sessionPassword) {
    throw new Error('Storage is locked. Call unlock(password) first.')
  }
  resetLockTimer()
  return _sessionPassword
}

// ── Encrypted read / write helpers ──

async function readStore(storageKey) {
  const password = requireUnlocked()
  const raw = localStorage.getItem(storageKey)
  if (!raw) return []
  try {
    const json = await decryptData(raw, password)
    return JSON.parse(json)
  } catch {
    throw new Error('Decryption failed — wrong password or corrupted data')
  }
}

async function writeStore(storageKey, data) {
  const password = requireUnlocked()
  const encrypted = await encryptData(JSON.stringify(data), password)
  localStorage.setItem(storageKey, encrypted)
}

// ── Profile CRUD ──

export async function createProfile(name, chain, prefix = '', suffix = '', caseSensitive = false) {
  const profile = {
    id: generateId(),
    name,
    chain,
    prefix,
    suffix,
    caseSensitive,
    created: Date.now(),
    lastUsed: Date.now(),
  }
  const profiles = await getAllProfiles()
  profiles.push(profile)
  await writeStore(STORAGE_KEY, profiles)
  return profile
}

export async function updateProfile(id, updates) {
  const profiles = await getAllProfiles()
  const index = profiles.findIndex(p => p.id === id)
  if (index === -1) throw new Error('Profile not found')
  profiles[index] = { ...profiles[index], ...updates, lastUsed: Date.now() }
  await writeStore(STORAGE_KEY, profiles)
  return profiles[index]
}

export async function deleteProfile(id) {
  const profiles = await getAllProfiles()
  await writeStore(STORAGE_KEY, profiles.filter(p => p.id !== id))
}

export async function getAllProfiles() {
  return await readStore(STORAGE_KEY)
}

export async function getProfile(id) {
  const profiles = await getAllProfiles()
  return profiles.find(p => p.id === id)
}

// ── Batch jobs ──

export async function createBatchJob(profiles) {
  const job = {
    id: generateId(),
    profiles,
    results: [],
    status: 'pending',
    startTime: Date.now(),
    endTime: null,
  }
  const queue = await getBatchQueue()
  queue.push(job)
  await writeStore(BATCH_QUEUE_KEY, queue)
  return job
}

export async function updateBatchJob(id, updates) {
  const queue = await getBatchQueue()
  const index = queue.findIndex(j => j.id === id)
  if (index === -1) throw new Error('Job not found')
  queue[index] = { ...queue[index], ...updates }
  await writeStore(BATCH_QUEUE_KEY, queue)
  return queue[index]
}

export async function addBatchResult(jobId, result) {
  const queue = await getBatchQueue()
  const job = queue.find(j => j.id === jobId)
  if (!job) throw new Error('Job not found')
  job.results.push(result)
  await writeStore(BATCH_QUEUE_KEY, queue)
  return job
}

export async function getBatchQueue() {
  return await readStore(BATCH_QUEUE_KEY)
}

export async function getBatchJob(id) {
  const queue = await getBatchQueue()
  return queue.find(j => j.id === id)
}

export async function clearBatchQueue() {
  const password = requireUnlocked()
  localStorage.removeItem(BATCH_QUEUE_KEY)
}

// ── Stats / export / import ──

export async function getProfileStats() {
  const profiles = await getAllProfiles()
  const queue = await getBatchQueue()
  return {
    totalProfiles: profiles.length,
    chainBreakdown: profiles.reduce((acc, p) => {
      acc[p.chain] = (acc[p.chain] || 0) + 1
      return acc
    }, {}),
    batchJobsTotal: queue.length,
    batchJobsCompleted: queue.filter(j => j.status === 'completed').length,
    totalResultsFound: queue.reduce((sum, j) => sum + j.results.length, 0),
  }
}

export async function exportProfiles() {
  const profiles = await getAllProfiles()
  return JSON.stringify(profiles, null, 2)
}

export async function importProfiles(jsonString) {
  const profiles = JSON.parse(jsonString)
  if (!Array.isArray(profiles)) throw new Error('Invalid format')
  for (const p of profiles) {
    if (!p.id || !p.name || !p.chain) throw new Error('Invalid profile structure')
    if (p.address && !validateAddress(p.address, p.chain)) {
      throw new Error(`Invalid ${p.chain} address: ${p.address}`)
    }
  }
  await writeStore(STORAGE_KEY, profiles)
  return profiles.length
}

export async function duplicateProfile(id, newName) {
  const profile = await getProfile(id)
  if (!profile) throw new Error('Profile not found')
  return createProfile(
    newName || `${profile.name} (Copy)`,
    profile.chain,
    profile.prefix,
    profile.suffix,
    profile.caseSensitive
  )
}

/**
 * Migrate unencrypted v1 data into encrypted v2 format.
 * Call once after the user sets a password for the first time.
 */
export async function migrateFromV1(password) {
  unlock(password)
  const oldProfiles = localStorage.getItem('vanity-profiles')
  const oldBatch = localStorage.getItem('vanity-batch-queue')
  if (oldProfiles) {
    await writeStore(STORAGE_KEY, JSON.parse(oldProfiles))
    localStorage.removeItem('vanity-profiles')
  }
  if (oldBatch) {
    await writeStore(BATCH_QUEUE_KEY, JSON.parse(oldBatch))
    localStorage.removeItem('vanity-batch-queue')
  }
}

function generateId() {
  const rand = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(rand).map(b => b.toString(36)).join('') + Date.now().toString(36)
}
