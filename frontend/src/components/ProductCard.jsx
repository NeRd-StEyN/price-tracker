import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, ShieldAlert, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatRelativeTime, formatExactTime, formatPrice, getCategoryIcon } from '../utils';
import { StockBadge, StatusBadge, PriceChangeChip } from './Badges';

export default function ProductCard({ product, onRetrack, onUntrack, isRetracking }) {
  const navigate = useNavigate();
  const CategoryIcon = getCategoryIcon(product.category);

  const latestGood = product.latest_good;
  const lastAttempt = product.last_attempt;
  const currentPrice = latestGood ? latestGood.price : null;
  const mrp = latestGood ? latestGood.mrp : null;
  const extId = String(product.external_id || '').replace(/[^0-9]/g, '');

  // Calculate discount % if MRP exists and is higher than current price
  let discountPct = null;
  if (mrp && currentPrice && mrp > currentPrice) {
    discountPct = Math.round(((mrp - currentPrice) / mrp) * 100);
  }

  const handleCardClick = (e) => {
    // Navigate to product detail unless target is an interactive action button
    if (e.target.closest('button') || e.target.closest('a')) return;
    navigate(`/product/${product.id}`);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={handleCardClick}
      className="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col justify-between group relative border border-white/10 p-5 shadow-xl cursor-pointer"
    >
      <div>
        {/* Top Header Row: Category Icon + Badges */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0">
            <CategoryIcon className="w-5 h-5" />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <StockBadge stockState={product.stock_state} stockUnits={latestGood?.stock_units} />
            <StatusBadge status={lastAttempt?.status} />
          </div>
        </div>

        {/* Brand & SKU */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1.5">
          {product.brand && <span className="text-slate-300">{product.brand}</span>}
          {product.brand && product.sku && <span>•</span>}
          {product.sku && <span className="font-mono text-slate-400">{product.sku}</span>}
          {!product.brand && !product.sku && <span className="capitalize">{product.category || 'General'}</span>}
        </div>

        {/* Product Title */}
        <h3 className="font-bold text-slate-100 text-base line-clamp-2 leading-snug mb-4 group-hover:text-emerald-400 transition-colors">
          {product.name}
        </h3>

        {/* Price Section */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-extrabold text-white tracking-tight">
              {formatPrice(currentPrice)}
            </span>

            {mrp && mrp > currentPrice && (
              <span className="text-xs text-slate-500 line-through">
                {formatPrice(mrp)}
              </span>
            )}

            {discountPct && (
              <span className="text-xs font-bold text-emerald-400">
                {discountPct}% OFF
              </span>
            )}

            <PriceChangeChip changePct={product.price_change_pct} />
          </div>
        </div>



        {product.overdue && (
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span>Overdue — scheduler may not be running</span>
          </div>
        )}
      </div>

      {/* Footer Timestamp & Action Buttons */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
        <div 
          className="flex items-center gap-1.5"
          title={lastAttempt ? `Last Attempt: ${formatExactTime(lastAttempt.scraped_at)}` : 'Never synced'}
        >
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {lastAttempt ? `Updated ${formatRelativeTime(lastAttempt.scraped_at)}` : 'Never scraped'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Retrack Button */}
          {onRetrack && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRetrack(product.id);
              }}
              disabled={isRetracking}
              title="Retrack this product"
              className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition-all flex items-center gap-1 font-semibold text-[11px] shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRetracking ? 'animate-spin' : ''}`} />
              <span>Retrack</span>
            </button>
          )}

          {/* External Merchant Store Link */}
          {extId && (
            <a
              href={`https://demo.inelabteamdev.com/product/${extId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open in Merchant Store"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Delete / Untrack Button */}
          {onUntrack && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUntrack(product.id, product.name);
              }}
              title="Untrack product"
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
