import React, { useState } from 'react'
import { Copy, Eye, EyeOff, Download } from 'lucide-react'

export default function Results({ results }) {
  const [visibleKeys, setVisibleKeys] = useState({})

  const toggleKeyVisibility = (index) => {
    setVisibleKeys(prev => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  const downloadKeystore = (address, privateKey) => {
    // Simple keystore format (Simplified UTC/JSON)
    const keystore = {
      address,
      privateKey,
      generatedAt: new Date().toISOString(),
    }
    const json = JSON.stringify(keystore, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${address.slice(0, 6)}-keystore.json`
    a.click()
  }

  if (results.length === 0) {
    return (
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Results</h2>
        <div className="text-center py-8 text-gray-500">
          No addresses generated yet
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Results ({results.length})</h2>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {results.map((result, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            {/* Address */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-mono text-sm break-all text-primary-600 dark:text-primary-400" data-testid="result-address">
                {result.address}
              </div>
              <button
                onClick={() => copyToClipboard(result.address)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                title="Copy address"
              >
                <Copy size={16} />
              </button>
            </div>

            {/* Private Key (Hidden by default) */}
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-xs">
                {visibleKeys[idx] ? (
                  <span className="text-red-600 dark:text-red-400 break-all">{result.privateKey}</span>
                ) : (
                  <span className="text-gray-400">••••••••••••••••••••••••••••••••••••••••••</span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => toggleKeyVisibility(idx)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title={visibleKeys[idx] ? 'Hide private key' : 'Show private key'}
                >
                  {visibleKeys[idx] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => downloadKeystore(result.address, result.privateKey)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title="Download keystore"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
