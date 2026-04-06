import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import useCloak from './hooks/useCloak';
import Generator from './components/Generator';
import Results from './components/Results';
import Statistics from './components/Statistics';

function CloakSeedPage() {
  const cloak = useCloak();
  return (
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
  );
}

function VanityPage() {
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ generated: 0, speed: 0, found: 0, elapsed: 0 });

  const handleResult = (result) => {
    setResults((prev) => [...prev, result]);
  };

  const handleStatsUpdate = (newStats) => {
    setStats(newStats);
  };

  return (
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
  );
}

function NavBar() {
  const linkBase = 'px-5 py-2.5 rounded-lg font-medium text-sm transition-colors';
  const activeClass = 'bg-blue-600 text-white shadow-glow';
  const inactiveClass = 'text-gray-400 hover:text-white hover:bg-gray-800';

  return (
    <nav className="border-b border-gray-800 mb-8">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="text-xl font-bold gradient-text">⟠ VanityCloakSeed</div>
        <div className="flex gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `${linkBase} ${isActive ? activeClass : inactiveClass}`}
          >
            🔑 Vanity Generator
          </NavLink>
          <NavLink
            to="/cloakseed"
            className={({ isActive }) => `${linkBase} ${isActive ? activeClass : inactiveClass}`}
          >
            🔐 CloakSeed
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
        <NavBar />
        <main className="px-4 pb-12">
          <Routes>
            <Route path="/" element={<VanityPage />} />
            <Route path="/cloakseed" element={<CloakSeedPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
