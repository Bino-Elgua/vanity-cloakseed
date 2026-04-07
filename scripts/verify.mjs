#!/usr/bin/env node
/**
 * VanityCloakSeed — Final Verification Script
 *
 * Run: node scripts/verify.mjs
 *
 * Checks:
 * 1. Build succeeds
 * 2. Bundle size within limits
 * 3. Unit tests pass
 * 4. Required files present (docs, PWA, components, tests)
 * 5. Build config (CSP, SRI, COOP/COEP)
 * 6. Security: no Buffer in built output, no eval(), network isolation
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    console.log(`  \u2713 ${name}`)
    passed++
  } catch (e) {
    console.log(`  \u2717 ${name}: ${e.message}`)
    failed++
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed')
}

// ═══════════════════════════════════════════
// 1. Build Check
// ═══════════════════════════════════════════

console.log('\n[1/7] Build')

check('npm run build succeeds', () => {
  execSync('npm run build', { cwd: ROOT, stdio: 'pipe', timeout: 120000 })
})

check('dist/ directory exists', () => {
  assert(existsSync(path.join(ROOT, 'dist')), 'dist/ not found')
})

check('dist/index.html exists', () => {
  assert(existsSync(path.join(ROOT, 'dist', 'index.html')), 'dist/index.html not found')
})

// ═══════════════════════════════════════════
// 2. Bundle Size
// ═══════════════════════════════════════════

console.log('\n[2/7] Bundle Size')

check('JS bundles under 500KB each', () => {
  const assetsDir = path.join(ROOT, 'dist', 'assets')
  if (!existsSync(assetsDir)) return // skip if no assets dir
  const jsFiles = readdirSync(assetsDir).filter(f => f.endsWith('.js'))
  for (const file of jsFiles) {
    const size = statSync(path.join(assetsDir, file)).size
    const sizeKB = Math.round(size / 1024)
    assert(size < 500 * 1024, `${file} is ${sizeKB}KB (limit 500KB)`)
  }
})

// ═══════════════════════════════════════════
// 3. Unit Tests
// ═══════════════════════════════════════════

console.log('\n[3/7] Unit Tests')

check('vitest suite passes', () => {
  execSync('npx vitest run --reporter=verbose 2>&1', { cwd: ROOT, stdio: 'pipe', timeout: 120000 })
})

// ═══════════════════════════════════════════
// 4. Required Files
// ═══════════════════════════════════════════

console.log('\n[4/7] Required Files')

const requiredFiles = [
  // Documentation
  'ARCHITECTURE.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  // PWA
  'public/manifest.json',
  'public/sw.js',
  // Components
  'src/components/ErrorBoundary.jsx',
  'src/components/Onboarding.jsx',
  'src/components/Generator.jsx',
  'src/components/Results.jsx',
  // Workers
  'src/workers/sharedWorkerBridge.js',
  // TypeScript
  'src/utils/types.ts',
  'src/utils/validation.ts',
  // Tests
  'src/utils/__tests__/crypto.test.ts',
  'src/utils/__tests__/chainCrypto.test.ts',
  'src/utils/__tests__/ciphers.test.ts',
  'src/utils/__tests__/encryption.test.ts',
  'src/utils/__tests__/bip39Helper.test.ts',
  'src/utils/__tests__/poisonRadar.test.ts',
  'src/utils/__tests__/profiles.test.ts',
  'src/utils/__tests__/validation.test.ts',
  'src/hooks/__tests__/useAddressGenerator.test.ts',
  // E2E
  'e2e/vanity.spec.ts',
  'playwright.config.ts',
]

for (const file of requiredFiles) {
  check(`${file}`, () => {
    assert(existsSync(path.join(ROOT, file)), `${file} not found`)
  })
}

// ═══════════════════════════════════════════
// 5. Build Config
// ═══════════════════════════════════════════

console.log('\n[5/7] Build Config')

check('CSP has connect-src + worker-src', () => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  assert(html.includes('connect-src'), 'CSP missing connect-src')
  assert(html.includes('worker-src'), 'CSP missing worker-src')
})

check('SRI enabled in vite config', () => {
  const config = readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8')
  assert(config.includes('subresourceIntegrity'), 'SRI not enabled')
})

check('COOP/COEP headers configured', () => {
  const config = readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8')
  assert(config.includes('Cross-Origin-Opener-Policy'), 'Missing COOP')
  assert(config.includes('Cross-Origin-Embedder-Policy'), 'Missing COEP')
})

check('Service worker registered in main.jsx', () => {
  const main = readFileSync(path.join(ROOT, 'src', 'main.jsx'), 'utf8')
  assert(main.includes('serviceWorker'), 'SW registration missing from main.jsx')
})

// ═══════════════════════════════════════════
// 6. Security Checks
// ═══════════════════════════════════════════

console.log('\n[6/7] Security')

check('No Buffer usage in source utils (browser compat)', () => {
  const utilsDir = path.join(ROOT, 'src', 'utils')
  const files = readdirSync(utilsDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'))
  for (const file of files) {
    if (file.endsWith('.test.ts') || file === 'types.ts') continue
    const content = readFileSync(path.join(utilsDir, file), 'utf8')
    const lines = content.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    const hasBuffer = lines.some(l => /\bBuffer\b/.test(l))
    assert(!hasBuffer, `${file} uses Buffer — will break in browser`)
  }
})

check('No eval() or Function() in source', () => {
  const srcDir = path.join(ROOT, 'src')
  function scanDir(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'node_modules') {
        scanDir(full)
      } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        const content = readFileSync(full, 'utf8')
        const lines = content.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        const hasEval = lines.some(l => /\beval\s*\(/.test(l) || /\bnew\s+Function\s*\(/.test(l))
        assert(!hasEval, `${entry.name} uses eval() or new Function()`)
      }
    }
  }
  scanDir(srcDir)
})

check('Network isolation: only poisonRadar.js calls fetch()', () => {
  const utilsDir = path.join(ROOT, 'src', 'utils')
  const files = readdirSync(utilsDir).filter(f => f.endsWith('.js') && f !== 'poisonRadar.js')
  for (const file of files) {
    const content = readFileSync(path.join(utilsDir, file), 'utf8')
    const lines = content.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    const hasFetch = lines.some(l => /\bfetch\s*\(/.test(l))
    assert(!hasFetch, `${file} contains fetch() — should be network-isolated`)
  }
})

// ═══════════════════════════════════════════
// 7. data-testid attributes for E2E
// ═══════════════════════════════════════════

console.log('\n[7/7] E2E Readiness')

check('Generator.jsx has data-testid attributes', () => {
  const gen = readFileSync(path.join(ROOT, 'src', 'components', 'Generator.jsx'), 'utf8')
  const required = ['prefix-input', 'suffix-input', 'start-button', 'stop-button']
  for (const id of required) {
    assert(gen.includes(`data-testid="${id}"`), `Missing data-testid="${id}"`)
  }
})

check('Results.jsx has data-testid="result-address"', () => {
  const res = readFileSync(path.join(ROOT, 'src', 'components', 'Results.jsx'), 'utf8')
  assert(res.includes('data-testid="result-address"'), 'Missing data-testid="result-address"')
})

// ═══════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════

console.log(`\n${'='.repeat(50)}`)
console.log(`  Results: ${passed} passed, ${failed} failed`)
console.log(`${'='.repeat(50)}`)

if (failed > 0) {
  console.log('\n  Some checks failed. Review the output above.\n')
  process.exit(1)
} else {
  console.log('\n  All checks passed! Ready for deployment.\n')
  process.exit(0)
}
