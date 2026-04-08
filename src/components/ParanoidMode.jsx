import React from 'react'
import { useParanoidMode } from '../hooks/useParanoidMode.jsx'

export default function ParanoidMode() {
  const { enabled, toggle } = useParanoidMode()

  return (
    <div className={`p-4 rounded-lg border ${enabled ? 'bg-red-900/20 border-red-700' : 'bg-gray-800 border-gray-700'}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">
            🛡️ Paranoid Mode {enabled ? '(ACTIVE)' : ''}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {enabled
              ? 'All storage is memory-only. Nothing persists to disk.'
              : 'Enable to block all localStorage. Data lives only in memory.'}
          </p>
        </div>
        <button
          onClick={toggle}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            enabled
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  )
}
