import React, { useState } from 'react'
import { useSecurity } from '../context/SecurityContext.jsx'

export default function ParanoidMode() {
  const { isParanoidMode, toggleParanoidMode } = useSecurity()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleToggle = () => {
    if (!isParanoidMode) {
      setShowConfirm(true)
    } else {
      toggleParanoidMode()
    }
  }

  const confirmEnable = () => {
    setShowConfirm(false)
    toggleParanoidMode()
  }

  return (
    <>
      <div className={`p-4 rounded-lg border ${isParanoidMode ? 'bg-red-900/20 border-red-700' : 'bg-gray-800 border-gray-700'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">
              🛡️ Paranoid Mode {isParanoidMode ? '(ACTIVE)' : ''}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {isParanoidMode
                ? 'All storage is memory-only. Nothing persists to disk.'
                : 'Enable to block all localStorage. Data lives only in memory.'}
            </p>
          </div>
          <button
            onClick={handleToggle}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isParanoidMode
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {isParanoidMode ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-red-700 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-red-400 mb-3">⚠️ Enable Paranoid Mode?</h3>
            <p className="text-sm text-gray-300 mb-2">
              This will block <strong>all localStorage access</strong>. Data will exist only in memory.
            </p>
            <p className="text-sm text-red-400 font-medium mb-4">
              All cipher data, settings, and session state will be lost when you refresh or close this tab.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEnable}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
