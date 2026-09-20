import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, PackageOpen, Loader2 } from 'lucide-react';

export function LoadingSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 pt-8 max-w-7xl mx-auto">
      <div className="h-12 bg-slate-900/60 rounded-xl w-1/3 animate-pulse border border-white/5"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-slate-900/40 rounded-2xl animate-pulse border border-white/5"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="h-72 bg-slate-900/40 rounded-2xl animate-pulse border border-white/5"></div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center p-12 glass-panel border border-rose-500/30 rounded-3xl text-center max-w-2xl mx-auto mt-12 shadow-2xl shadow-rose-500/10"
    >
      <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6 border border-rose-500/20">
        <AlertTriangle className="w-8 h-8 text-rose-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Service Exception</h2>
      <p className="text-slate-400 text-sm mb-8 max-w-md">
        {error instanceof Error ? error.message : String(error)}
      </p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="bg-rose-500/20 text-rose-200 border border-rose-500/30 px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-rose-500/10 hover:bg-rose-500 hover:text-white transition-all text-sm"
        >
          Retry Request
        </button>
      )}
    </motion.div>
  );
}

export function EmptyState({ title, description, actionText, onAction }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center p-12 md:p-16 glass-panel border border-dashed border-white/15 rounded-3xl text-center max-w-2xl mx-auto mt-8 shadow-2xl"
    >
      <div className="w-20 h-20 bg-slate-900/80 rounded-2xl flex items-center justify-center mb-6 border border-white/10 shadow-inner">
        <PackageOpen className="w-10 h-10 text-emerald-400" />
      </div>
      <h2 className="text-2xl font-extrabold text-white mb-2">{title}</h2>
      <p className="text-slate-400 text-sm md:text-base mb-8 max-w-md leading-relaxed">{description}</p>
      {onAction && actionText && (
        <button 
          onClick={onAction}
          className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-8 py-3 rounded-xl font-semibold shadow-lg shadow-emerald-500/10 hover:bg-emerald-500 hover:text-white transition-all text-sm"
        >
          {actionText}
        </button>
      )}
    </motion.div>
  );
}

export function Spinner({ size = 'default' }) {
  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-6 h-6',
    large: 'w-10 h-10'
  };
  
  return (
    <Loader2 className={`${sizeClasses[size]} animate-spin text-emerald-400`} />
  );
}

