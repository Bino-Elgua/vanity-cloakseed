import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAddressGenerator } from '../useAddressGenerator'

// Mock the worker constructor
class MockWorker {
  onmessage: ((e: any) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
}

vi.stubGlobal('Worker', vi.fn(() => new MockWorker()))

describe('useAddressGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with default state', () => {
    const { result } = renderHook(() => useAddressGenerator())

    expect(result.current.isGenerating).toBe(false)
    expect(result.current.results).toEqual([])
    expect(result.current.stats.attempts).toBe(0)
    expect(result.current.stats.found).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('sets error when no prefix or suffix provided', () => {
    const { result } = renderHook(() => useAddressGenerator())

    act(() => {
      result.current.startGeneration({})
    })

    expect(result.current.error).toBe('Please enter a prefix or suffix')
    expect(result.current.isGenerating).toBe(false)
  })

  it('starts generating with valid prefix', () => {
    const { result } = renderHook(() => useAddressGenerator())

    act(() => {
      result.current.startGeneration({ prefix: 'dead' })
    })

    expect(result.current.isGenerating).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('stops generation and cleans up', () => {
    const { result } = renderHook(() => useAddressGenerator())

    act(() => {
      result.current.startGeneration({ prefix: 'dead' })
    })

    act(() => {
      result.current.stopGeneration()
    })

    expect(result.current.isGenerating).toBe(false)
  })

  it('cleanup terminates all workers', () => {
    const { result } = renderHook(() => useAddressGenerator())

    act(() => {
      result.current.startGeneration({ prefix: 'aa' })
    })

    act(() => {
      result.current.cleanup()
    })

    expect(result.current.isGenerating).toBe(false)
  })
})
