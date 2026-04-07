import { useCallback, useRef, useState } from 'react'
import { generatePrivateKey, getPublicKey, getAddressFromPublicKey, matchesPattern, calculateDifficulty } from '../utils/crypto'

const RATE_LIMIT_THRESHOLD = 5000 // 5 seconds with no new attempts
const RATE_LIMIT_PAUSE = 2000 // 2 second pause

export function useAddressGenerator() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [results, setResults] = useState([])
  const [stats, setStats] = useState({
    attempts: 0,
    found: 0,
    speed: 0,
    elapsed: 0,
    eta: 0,
  })
  const [error, setError] = useState(null)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [rateLimitMessage, setRateLimitMessage] = useState(null)

  const workersRef = useRef([])
  const startTimeRef = useRef(null)
  const statsIntervalRef = useRef(null)
  const attemptsRef = useRef(0)
  const lastAttemptTimeRef = useRef(0)

  /**
   * Initialize Web Workers for parallel generation
   */
  const initWorkers = useCallback((count = 4) => {
    // Clean up existing workers
    workersRef.current.forEach(w => w.terminate())
    workersRef.current = []

    for (let i = 0; i < count; i++) {
      const worker = new Worker(
        new URL('../workers/generatorWorker.js', import.meta.url),
        { type: 'module' }
      )

      worker.onmessage = (e) => {
        const { type, payload } = e.data

        if (type === 'result') {
          const { address, privateKey } = payload
          setResults(prev => [...prev, { address, privateKey, timestamp: new Date() }])
        } else if (type === 'stats') {
          attemptsRef.current += 1000
          lastAttemptTimeRef.current = Date.now()
          setStats(prev => ({
            ...prev,
            attempts: attemptsRef.current,
            speed: payload.speed,
          }))
        }
      }

      workersRef.current.push(worker)
    }
  }, [])

  /**
   * Start address generation
   */
  const startGeneration = useCallback((options = {}) => {
    const {
      prefix = '',
      suffix = '',
      caseSensitive = false,
      maxResults = 10,
      workerCount = navigator.hardwareConcurrency || 4,
    } = options

    if (!prefix && !suffix) {
      setError('Please enter a prefix or suffix')
      return
    }

    setIsGenerating(true)
    setError(null)
    setResults([])
    setStats({ attempts: 0, found: 0, speed: 0, elapsed: 0, eta: 0 })
    setIsRateLimited(false)
    setRateLimitMessage(null)
    attemptsRef.current = 0
    lastAttemptTimeRef.current = Date.now()
    startTimeRef.current = Date.now()

    // Initialize workers
    initWorkers(workerCount)

    // Start all workers
    const difficulty = calculateDifficulty(prefix, suffix)
    workersRef.current.forEach((worker, i) => {
      worker.postMessage({
        action: 'start',
        payload: { workerId: i, prefix, suffix, caseSensitive, maxResults },
      })
    })

    // Update stats every 500ms
    statsIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const avgSpeed = attemptsRef.current / (elapsed || 1)
      const eta = difficulty / (avgSpeed || 1)

      // Detect stall / rate limiting
      const timeSinceLastAttempt = Date.now() - lastAttemptTimeRef.current
      if (timeSinceLastAttempt > RATE_LIMIT_THRESHOLD && !isRateLimited) {
        setIsRateLimited(true)
        setRateLimitMessage('Generation paused to prevent browser freeze. Resuming...')
        setTimeout(() => {
          setIsRateLimited(false)
          setRateLimitMessage(null)
        }, RATE_LIMIT_PAUSE)
      }

      setStats(prev => ({
        ...prev,
        elapsed: Math.round(elapsed),
        eta: Math.round(eta),
      }))

      // Stop if we have enough results
      if (results.length >= maxResults) {
        stopGeneration()
      }
    }, 500)
  }, [initWorkers])

  /**
   * Stop generation
   */
  const stopGeneration = useCallback(() => {
    setIsGenerating(false)
    setIsRateLimited(false)
    setRateLimitMessage(null)
    workersRef.current.forEach(w => w.postMessage({ action: 'stop' }))
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current)
    }
  }, [])

  /**
   * Cleanup
   */
  const cleanup = useCallback(() => {
    stopGeneration()
    workersRef.current.forEach(w => w.terminate())
    workersRef.current = []
  }, [stopGeneration])

  return {
    isGenerating,
    results,
    stats,
    error,
    isRateLimited,
    rateLimitMessage,
    startGeneration,
    stopGeneration,
    cleanup,
  }
}
