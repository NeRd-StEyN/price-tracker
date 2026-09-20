import React from 'react';
import { CheckCircle2, AlertCircle, HelpCircle, Clock, AlertTriangle } from 'lucide-react';

/**
 * Stock Badge (3 states: in_stock, out_of_stock, unknown).
 * Displays stock_units if available (e.g., "23 left").
 */
export function StockBadge({ stockState, stockUnits }) {
  if (stockState === 'in_stock') {
    const label = stockUnits && stockUnits > 0 ? `${stockUnits} in stock` : 'In stock';
    return (
      <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
        <span>{label}</span>
      </span>
    );
  }

  if (stockState === 'out_of_stock') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
        <span>Out of stock</span>
      </span>
    );
  }

  return (
    <span className="px-2.5 py-1 rounded-full bg-slate-800/90 text-slate-400 border border-white/10 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
      <span>Unknown</span>
    </span>
  );
}

/**
 * Status Badge for last scrape attempt:
 * success (green), retried (yellow/amber), failed (red).
 */
export function StatusBadge({ status }) {
  if (status === 'success') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
        <span>Success</span>
      </span>
    );
  }

  if (status === 'retried') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold flex items-center gap-1 shadow-sm">
        <Clock className="w-3.5 h-3.5 text-amber-400" />
        <span>Retried</span>
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 shadow-sm">
        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
        <span>Failed</span>
      </span>
    );
  }

  return (
    <span className="px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-white/10 text-xs font-semibold flex items-center gap-1 shadow-sm">
      <span>Pending</span>
    </span>
  );
}

/**
 * Price Change Chip (green down / red up / grey none).
 * Shows percentage drop or increase vs previous good read.
 */
export function PriceChangeChip({ changePct }) {
  if (changePct === null || changePct === undefined || isNaN(changePct) || changePct === 0) {
    return null;
  }

  const isDrop = changePct < 0; // Price drop is good for buyer (green)
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-0.5 ${
      isDrop 
        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
    }`}>
      {isDrop ? '↓' : '↑'} {Math.abs(changePct)}%
    </span>
  );
}
