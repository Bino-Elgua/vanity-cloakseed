import React, { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Shield, Key, Eye } from 'lucide-react'

const steps = [
  {
    icon: Shield,
    title: 'Secure Vanity Addresses',
    description: 'Generate custom Ethereum addresses that start or end with your chosen pattern. All computation happens in your browser — your private keys never leave your device.',
  },
  {
    icon: Key,
    title: 'CloakSeed Protection',
    description: "Hide your real seed phrase behind a custom 2048-word cipher. Even if someone sees your cloak phrase, they can't access your wallet without your unique cipher.",
  },
  {
    icon: Eye,
    title: 'Poison Radar',
    description: 'Check if an address has been targeted by dust attacks or address poisoning before you use it. Stay safe from scammers.',
  },
]

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('vanity-onboarding-complete')
    if (!hasSeenOnboarding) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const CurrentIcon = steps[step].icon

  const handleDismiss = () => {
    localStorage.setItem('vanity-onboarding-complete', 'true')
    setVisible(false)
    onComplete?.()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 w-8 rounded-full ${i === step ? 'bg-blue-500' : 'bg-gray-700'}`}
              />
            ))}
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CurrentIcon size={32} className="text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{steps[step].title}</h3>
          <p className="text-gray-400 leading-relaxed">{steps[step].description}</p>
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 px-4 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <ChevronLeft size={18} /> Back
            </button>
          )}

          <button
            onClick={() => {
              if (step < steps.length - 1) {
                setStep(s => s + 1)
              } else {
                handleDismiss()
              }
            }}
            className="flex-1 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {step < steps.length - 1 ? (
              <>Next <ChevronRight size={18} /></>
            ) : (
              'Get Started'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
