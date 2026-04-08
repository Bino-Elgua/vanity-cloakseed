import { createContext, useCallback, useContext, useState } from 'react'

const SecurityContext = createContext({
  isParanoidMode: false,
  toggleParanoidMode: () => {},
})

const memoryStore = {}
let noopStorage = null

function getNoopStorage() {
  if (!noopStorage) {
    noopStorage = {
      getItem: (key) => memoryStore[key] ?? null,
      setItem: (key, value) => { memoryStore[key] = String(value) },
      removeItem: (key) => { delete memoryStore[key] },
      clear: () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]) },
      get length() { return Object.keys(memoryStore).length },
      key: (i) => Object.keys(memoryStore)[i] ?? null,
    }
  }
  return noopStorage
}

export function SecurityProvider({ children }) {
  const [isParanoidMode, setIsParanoidMode] = useState(false)

  const toggleParanoidMode = useCallback(() => {
    setIsParanoidMode(prev => {
      const next = !prev
      if (next) {
        window.__originalLocalStorage = window.__originalLocalStorage || window.localStorage
        try {
          Object.defineProperty(window, 'localStorage', {
            value: getNoopStorage(),
            writable: true,
            configurable: true,
          })
        } catch {
          // Already overridden
        }
      } else {
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
    <SecurityContext.Provider value={{ isParanoidMode, toggleParanoidMode }}>
      {children}
    </SecurityContext.Provider>
  )
}

export function useSecurity() {
  return useContext(SecurityContext)
}

export default SecurityContext
