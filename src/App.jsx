import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import useCloak from './hooks/useCloak';
import ErrorBoundary from './components/ErrorBoundary';
import Onboarding from './components/Onboarding';

// Lazy-loaded heavy components (code-split by Vite)
const Generator = lazy(() => import('./components/Generator'));
const Results = lazy(() => import('./components/Results'));
const Statistics = lazy(() => import('./components/Statistics'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
    </div>
  );
}

function CloakSeedPage() {
  const cloak = useCloak();
  return (
    <ErrorBoundary fallbackTitle="CloakSeed Error">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 gradient-text">CloakSeed</h2>
        <p className="mb-4 text-gray-400">Status: {cloak.cipher ? 'cipher loaded' : 'no cipher'}</p>
        <button
          onClick={() => cloak.setCipherFromTheme('animals')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          Load Animals Theme
        </button>
        <p className="mt-4 text-gray-400">Real Seed: {cloak.realSeed || 'none'}</p>
      </div>
    </ErrorBoundary>
  );
}

function VanityPage() {
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ generated: 0, speed: 0, found: 0, elapsed: 0 });

  const handleResult = (result) => {
    setResults((prev) => [...prev, result]);
    // Haptic feedback on mobile when address found
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleStatsUpdate = (newStats) => {
    setStats(newStats);
  };

  return (
    <ErrorBoundary fallbackTitle="Generator Error">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 gradient-text">Vanity Address Generator</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Generator onResult={handleResult} onStatsUpdate={handleStatsUpdate} />
            <Results results={results} />
          </div>
          <div>
            <Statistics />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function NavBar() {
  const linkBase = 'px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-colors';
  const activeClass = 'bg-blue-600 text-white shadow-glow';
  const inactiveClass = 'text-gray-400 hover:text-white hover:bg-gray-800';

  return (
    <nav className="border-b border-gray-800 mb-4 sm:mb-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
        <div className="text-base sm:text-xl font-bold gradient-text">VanityCloakSeed</div>
        <div className="flex gap-1 sm:gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `${linkBase} ${isActive ? activeClass : inactiveClass}`}
          >
            Vanity
          </NavLink>
          <NavLink
            to="/cloakseed"
            className={({ isActive }) => `${linkBase} ${isActive ? activeClass : inactiveClass}`}
          >
            CloakSeed
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-black text-white">
        <Onboarding />
        <NavBar />
        <main className="px-4 pb-12">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<VanityPage />} />
              <Route path="/cloakseed" element={<CloakSeedPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
}
