import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, PackageOpen, Loader2 } from 'lucide-react';

export function LoadingSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 pt-8 max-w-7xl mx-auto">
      <div className="h-12 bg-surface-2 rounded-xl w-1/3 animate-pulse border border-border"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-surface-2 rounded-[12px] animate-pulse border border-border"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="h-72 bg-surface-2 rounded-[12px] animate-pulse border border-border"></div>
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
      className="flex flex-col items-center justify-center p-12 glass-panel border border-danger-border rounded-[12px] text-center max-w-2xl mx-auto mt-12 shadow-xl"
    >
      <div className="w-16 h-16 badge-danger rounded-2xl flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-danger" />
      </div>
      <h2 className="text-2xl font-bold text-text mb-2">Service Exception</h2>
      <p className="text-text-muted text-sm mb-8 max-w-md">
        {error instanceof Error ? error.message : String(error)}
      </p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="badge-danger px-6 py-2.5 rounded-xl font-semibold shadow-md hover:bg-danger hover:text-bg transition-all text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
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
      className="flex flex-col items-center justify-center p-12 md:p-16 glass-panel border border-dashed border-border rounded-[12px] text-center max-w-2xl mx-auto mt-8 shadow-xl"
    >
      <div className="w-20 h-20 bg-surface-2 rounded-2xl flex items-center justify-center mb-6 border border-border shadow-inner">
        <PackageOpen className="w-10 h-10 text-accent" />
      </div>
      <h2 className="text-2xl font-extrabold text-text mb-2">{title}</h2>
      <p className="text-text-muted text-sm md:text-base mb-8 max-w-md leading-relaxed">{description}</p>
      {onAction && actionText && (
        <button 
          onClick={onAction}
          className="bg-accent text-bg px-8 py-3 rounded-xl font-bold shadow-md hover:bg-accent/90 transition-all text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
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
    <Loader2 className={`${sizeClasses[size]} animate-spin text-accent`} />
  );
}
