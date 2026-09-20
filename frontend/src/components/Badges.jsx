import React from 'react';
import { CheckCircle2, AlertCircle, HelpCircle, Clock, TrendingDown, TrendingUp, Minus } from 'lucide-react';

/**
 * Stock Badge (3 states: in_stock, out_of_stock, unknown).
 * Displays real stock units (e.g. "23 left") only if a genuine count > 1 exists.
 */
export function StockBadge({ stockState, stockUnits }) {
  if (stockState === 'in_stock') {
    const hasRealUnits = typeof stockUnits === 'number' && stockUnits > 1;
    const label = hasRealUnits ? `${stockUnits} left` : 'In stock';
    return (
      <span className="px-2.5 py-1 rounded-full badge-success text-[13px] font-semibold flex items-center gap-1.5 shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  if (stockState === 'out_of_stock') {
    return (
      <span className="px-2.5 py-1 rounded-full badge-danger text-[13px] font-semibold flex items-center gap-1.5 shadow-sm">
        <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
        <span>Out of stock</span>
      </span>
    );
  }

  return (
    <span className="px-2.5 py-1 rounded-full badge-neutral text-[13px] font-semibold flex items-center gap-1.5 shadow-sm">
      <HelpCircle className="w-3.5 h-3.5 text-neutral flex-shrink-0" />
      <span>Unknown</span>
    </span>
  );
}

/**
 * Status Badge for last scrape attempt:
 * success (green), retried (amber), failed (red).
 */
export function StatusBadge({ status }) {
  if (status === 'success') {
    return (
      <span className="px-2.5 py-1 rounded-full badge-success text-[13px] font-semibold flex items-center gap-1.5 shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
        <span>Success</span>
      </span>
    );
  }

  if (status === 'retried') {
    return (
      <span className="px-2.5 py-1 rounded-full badge-warning text-[13px] font-semibold flex items-center gap-1.5 shadow-sm">
        <Clock className="w-3.5 h-3.5 text-warning flex-shrink-0" />
        <span>Retried</span>
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="px-2.5 py-1 rounded-full badge-danger text-[13px] font-semibold flex items-center gap-1.5 shadow-sm">
        <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
        <span>Failed</span>
      </span>
    );
  }

  return (
    <span className="px-2.5 py-1 rounded-full badge-neutral text-[13px] font-semibold flex items-center gap-1.5 shadow-sm">
      <HelpCircle className="w-3.5 h-3.5 text-neutral flex-shrink-0" />
      <span>Pending</span>
    </span>
  );
}

/**
 * Price Change Chip (success down / danger up / neutral none).
 * Shows percentage drop or increase vs previous good read.
 */
export function PriceChangeChip({ changePct }) {
  if (changePct === null || changePct === undefined || isNaN(changePct) || changePct === 0) {
    return null;
  }

  const isDrop = changePct < 0; // Price drop is good for buyer (success)
  return (
    <span className={`px-2 py-0.5 rounded-md text-[13px] font-bold flex items-center gap-1 tabular-nums ${
      isDrop ? 'badge-success' : 'badge-danger'
    }`}>
      {isDrop ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
      <span>{Math.abs(changePct)}%</span>
    </span>
  );
}
