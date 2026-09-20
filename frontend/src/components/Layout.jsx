import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Package, Activity, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from './ErrorBoundary';

function Navbar() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Activity },
    { path: '/search', label: 'Search & Track', icon: Search }
  ];

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="glass-panel rounded-full px-6 py-3 flex items-center justify-between w-full max-w-5xl pointer-events-auto border border-white/10 shadow-2xl">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <Package className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight flex items-center gap-1">
            Price<span className="text-emerald-400 font-black">Pulse</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-full border border-white/10">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 bg-emerald-500/20 border border-emerald-500/40 rounded-full shadow-lg shadow-emerald-500/10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default function Layout({ children }) {
  const [showSlowWarning, setShowSlowWarning] = useState(false);

  useEffect(() => {
    const handleSlow = () => setShowSlowWarning(true);
    const handleResolved = () => setShowSlowWarning(false);

    document.addEventListener('api:slow-response', handleSlow);
    document.addEventListener('api:resolved', handleResolved);

    return () => {
      document.removeEventListener('api:slow-response', handleSlow);
      document.removeEventListener('api:resolved', handleResolved);
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200 bg-[#090D16]">
        <Navbar />

        <main className="relative flex-grow pt-28 pb-16 px-4 w-full max-w-7xl mx-auto">
          {/* Cold-start Banner: Shown ONLY when request > 3s, hidden immediately on completion */}
          <AnimatePresence>
            {showSlowWarning && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 glass-panel border-amber-500/40 bg-amber-500/10 text-amber-200 px-5 py-3.5 flex items-center gap-3 rounded-2xl shadow-xl"
              >
                <Loader2 className="w-5 h-5 animate-spin text-amber-400 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Server warming up (initial response taking longer than usual)... Please wait.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {children}
        </main>
      </div>
    </ErrorBoundary>
  );
}
