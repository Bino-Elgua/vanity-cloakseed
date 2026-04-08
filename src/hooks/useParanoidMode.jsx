import { createContext, useCallback, useContext, useState } from 'react'

const ParanoidModeContext = createContext({ enabled: false, toggle: () => {} })

export function ParanoidModeProvider({ children }) {
  const [enabled, setEnabled] = useState(false)

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      if (next) {
        // Override localStorage with no-op when entering paranoid mode
        window.__originalLocalStorage = window.__originalLocalStorage || window.localStorage
        const memoryStore = {}
        const noopStorage = {
          getItem: (key) => memoryStore[key] ?? null,
          setItem: (key, value) => { memoryStore[key] = String(value) },
          removeItem: (key) => { delete memoryStore[key] },
          clear: () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]) },
          get length() { return Object.keys(memoryStore).length },
          key: (i) => Object.keys(memoryStore)[i] ?? null,
        }
        try {
          Object.defineProperty(window, 'localStorage', {
            value: noopStorage,
            writable: true,
            configurable: true,
          })
        } catch {
          // Fallback: already overridden
        }
      } else {
        // Restore real localStorage
        if (window.__originalLocalStorage) {
          try {
            Object.defineProperty(window, 'localStorage', {
              value: window.__originalLocalStorage,
              writable: true,
              configurable: true,
            })
          } catch {
            // Fallback
          }
        }
      }
      return next
    })
  }, [])

  return (
    <ParanoidModeContext.Provider value={{ enabled, toggle }}>
      {children}
    </ParanoidModeContext.Provider>
  )
}

export function useParanoidMode() {
  return useContext(ParanoidModeContext)
}

export default ParanoidModeContext
