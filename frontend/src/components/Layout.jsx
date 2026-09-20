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
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 pb-3 px-4 pointer-events-none">
      <div className="glass-panel rounded-full px-6 py-3 flex items-center justify-between w-full max-w-5xl pointer-events-auto border border-border shadow-xl">
        <Link to="/" className="flex items-center gap-3 group focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded-lg p-1">
          <div className="w-9 h-9 rounded-xl badge-accent flex items-center justify-center shadow-sm">
            <Package className="w-5 h-5 text-accent" />
          </div>
          <span className="text-xl font-extrabold text-text tracking-tight flex items-center gap-1">
            Price<span className="text-accent font-black">Pulse</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 bg-surface-2/80 p-1.5 rounded-full border border-border">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                  isActive ? 'text-accent' : 'text-text-muted hover:text-text'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 badge-accent rounded-full shadow-sm"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
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
      <div className="min-h-screen flex flex-col text-text selection:bg-accent/30 selection:text-accent bg-bg">
        <Navbar />

        <main className="relative flex-grow pt-28 pb-16 px-4 w-full max-w-7xl mx-auto">
          {}
          <AnimatePresence>
            {showSlowWarning && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 glass-panel badge-warning px-5 py-3.5 flex items-center gap-3 rounded-[12px] shadow-lg"
              >
                <Loader2 className="w-5 h-5 animate-spin text-warning flex-shrink-0" />
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
