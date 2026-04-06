import React, { useState, useEffect } from 'react'
import { Play, Square, Copy, Download } from 'lucide-react'
import { generatePrivateKey, getPublicKey, getAddressFromPublicKey, matchesPattern, calculateDifficulty, formatTimeEstimate } from '../utils/crypto'

export default function Generator({ onResult, onStatsUpdate }) {
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [maxResults, setMaxResults] = useState(5)
  const [workerCount, setWorkerCount] = useState(navigator.hardwareConcurrency || 4)

  const [isGenerating, setIsGenerating] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [found, setFound] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [eta, setEta] = useState(0)

  const startTimeRef = React.useRef(null)
  const generationRef = React.useRef(null)

  /**
   * Start generation with optimized batching
   */
  const handleStart = async () => {
    if (!prefix && !suffix) {
      alert('Enter a prefix or suffix')
      return
    }

    setIsGenerating(true)
    setAttempts(0)
    setFound(0)
    setSpeed(0)
    setElapsed(0)
    startTimeRef.current = Date.now()

    const difficulty = calculateDifficulty(prefix, suffix)
    let localAttempts = 0
    let localFound = 0

    const controller = { aborted: false }
    generationRef.current = controller

    while (!controller.aborted && localFound < maxResults) {
      try {
        for (let batch = 0; batch < 1000 && !controller.aborted && localFound < maxResults; batch++) {
          const privateKey = generatePrivateKey()
          const publicKey = getPublicKey(privateKey)
          const address = getAddressFromPublicKey(publicKey)

          if (matchesPattern(address, prefix, suffix, caseSensitive)) {
            localFound++
            setFound(localFound)
            onResult({ address, privateKey, timestamp: new Date() })
          }

          localAttempts++
        }

        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const speed = elapsed > 0 ? localAttempts / elapsed : 0
        const eta = difficulty / (speed || 1)

        setAttempts(localAttempts)
        setSpeed(speed)
        setElapsed(Math.round(elapsed))
        setEta(Math.round(eta))

        onStatsUpdate({
          generated: localAttempts,
          speed: Math.round(speed),
          found: localFound,
          elapsed: Math.round(elapsed),
        })

        await new Promise(resolve => setTimeout(resolve, 0))
      } catch (error) {
        console.error('Generation error:', error)
      }
    }
    setIsGenerating(false)
  }

  const handleStop = () => {
    setIsGenerating(false)
    if (generationRef.current) {
      generationRef.current.aborted = true
    }
  }

  const progressPercent = Math.min((found / maxResults) * 100, 100)

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6">Address Generator</h2>

      <div className="space-y-4">
        {/* Inputs */}
        <div>
          <label className="block text-sm font-medium mb-2">Prefix (optional)</label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="e.g., deadbeef"
            disabled={isGenerating}
            className="input"
            maxLength="40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Suffix (optional)</label>
          <input
            type="text"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            placeholder="e.g., c0ffee"
            disabled={isGenerating}
            className="input"
            maxLength="40"
          />
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Worker Threads</label>
            <select
              value={workerCount}
              onChange={(e) => setWorkerCount(parseInt(e.target.value))}
              disabled={isGenerating}
              className="input"
            >
              {[1, 2, 4, 8, 16].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Max Results</label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value))}
              disabled={isGenerating}
              className="input"
            >
              {[1, 5, 10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Checkbox */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="caseSensitive"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            disabled={isGenerating}
            className="w-4 h-4"
          />
          <label htmlFor="caseSensitive" className="font-medium cursor-pointer">
            Case Sensitive
          </label>
        </div>

        {/* Difficulty Info */}
        {(prefix || suffix) && (
          <div className="alert alert-warning">
            <strong>Estimated Time (50%):</strong>{' '}
            {formatTimeEstimate(calculateDifficulty(prefix, suffix), 100000)}
          </div>
        )}

        {/* Progress Bar */}
        {isGenerating && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Progress: {found}/{maxResults}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        {isGenerating && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Speed</div>
              <div className="font-bold">{speed.toLocaleString(undefined, { maximumFractionDigits: 0 })} addr/s</div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">ETA</div>
              <div className="font-bold">{eta}s</div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Attempts</div>
              <div className="font-bold">{attempts.toLocaleString()}</div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Elapsed</div>
              <div className="font-bold">{elapsed}s</div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          {!isGenerating ? (
            <button
              onClick={handleStart}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Play size={18} />
              Generate Address
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="btn bg-red-500 hover:bg-red-600 text-white flex-1 flex items-center justify-center gap-2"
            >
              <Square size={18} />
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
