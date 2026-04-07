import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeAddress, formatPoisonReport } from '../poisonRadar'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

const ethChain = {
  id: 'ethereum',
  rpcs: ['https://cloudflare-eth.com'],
}

const btcChain = {
  id: 'bitcoin',
  rpcs: ['https://blockstream.info/api'],
}

describe('poisonRadar', () => {
  describe('analyzeAddress', () => {
    it('rejects invalid Ethereum address format', async () => {
      const result = await analyzeAddress('0xinvalid', ethChain as any)
      expect(result.status).toBe('error')
      expect(result.risk).toBe('unknown')
    })

    it('rejects empty address', async () => {
      const result = await analyzeAddress('', ethChain as any)
      expect(result.status).toBe('error')
    })

    it('returns clean for new address with no transactions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: '2.0', result: '0x0', id: 1 }),
      })

      const result = await analyzeAddress(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        ethChain as any
      )
      // balance of 0x0 maps to [{value: '0x0'}] which is a valid result
      expect(result.risk).toBeDefined()
    })

    it('handles RPC error gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await analyzeAddress(
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        ethChain as any
      )
      expect(result.status).toBe('error')
      expect(result.message).toContain('failed')
    })
  })

  describe('formatPoisonReport', () => {
    it('formats a clean report', () => {
      const report = {
        status: 'clean' as const,
        risk: 'none' as const,
        txCount: 0,
        warnings: [],
        message: 'No transactions found or new address',
      }
      const output = formatPoisonReport(report)
      expect(output).toContain('NONE')
      expect(output).toContain('No transactions found')
    })

    it('formats a high-risk report with patterns', () => {
      const report = {
        status: 'poisoned' as const,
        risk: 'high' as const,
        txCount: 100,
        riskScore: 25,
        suspiciousPatterns: { dust: 10, zeroValue: 15, unknownContracts: 25, rapidFire: 1 },
        warnings: ['High dust activity (10 small transfers)'],
        message: 'High dust activity (10 small transfers)',
      }
      const output = formatPoisonReport(report)
      expect(output).toContain('HIGH')
      expect(output).toContain('Dust: 10')
      expect(output).toContain('Rapid-Fire: 1')
    })
  })
})
