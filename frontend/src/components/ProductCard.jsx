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

  const isStale = Boolean(lastAttempt && lastAttempt.status === 'failed' && latestGood);

  // Calculate discount % if MRP exists and is higher than current price
  let discountPct = null;
  if (mrp && currentPrice && mrp > currentPrice) {
    discountPct = Math.round(((mrp - currentPrice) / mrp) * 100);
  }

  const handleCardClick = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    navigate(`/product/${product.id}`);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={handleCardClick}
      className="glass-panel glass-panel-hover rounded-[12px] overflow-hidden flex flex-col justify-between group relative p-5 shadow-md cursor-pointer border border-border"
    >
      <div>
        {/* Top Header Row: Category Icon + Badges */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-accent group-hover:border-accent-border transition-colors flex-shrink-0">
            <CategoryIcon className="w-5 h-5 text-accent" />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <StockBadge stockState={product.stock_state} stockUnits={latestGood?.stock_units} />
            <StatusBadge status={lastAttempt?.status} />
          </div>
        </div>

        {/* Brand & SKU */}
        <div className="flex items-center gap-2 text-[13px] font-medium text-text-muted mb-1.5">
          {product.brand && <span className="text-text font-semibold">{product.brand}</span>}
          {product.brand && product.sku && <span>•</span>}
          {product.sku && <span className="font-mono text-text-muted">{product.sku}</span>}
          {!product.brand && !product.sku && <span className="capitalize">{product.category || 'General'}</span>}
        </div>

        {/* Product Title */}
        <h3 className="font-bold text-text text-base line-clamp-2 leading-snug mb-3 group-hover:text-accent transition-colors">
          {product.name}
        </h3>

        {/* Price Section */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-[28px] font-extrabold tracking-tight tabular-nums ${isStale ? 'text-text-muted opacity-80' : 'text-text'}`}>
              {formatPrice(currentPrice)}
            </span>

            {mrp && mrp > currentPrice && (
              <span className="text-[13px] text-text-muted line-through tabular-nums">
                {formatPrice(mrp)}
              </span>
            )}

            {discountPct && (
              <span className="text-[13px] font-bold badge-accent px-1.5 py-0.5 rounded">
                {discountPct}% OFF
              </span>
            )}

            <PriceChangeChip changePct={product.price_change_pct} />
          </div>
        </div>

        {/* Stale Price Warning Banner */}
        {isStale && (
          <div className="mb-3 px-3 py-1.5 rounded-lg badge-warning text-[13px] font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
            <span>Stale — last good read {formatRelativeTime(latestGood.scraped_at)}</span>
          </div>
        )}

        {/* Overdue Warning Banner */}
        {product.overdue && !isStale && (
          <div className="mb-3 px-3 py-1.5 rounded-lg badge-warning text-[13px] font-medium flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-warning flex-shrink-0" />
            <span>Overdue — sync delayed</span>
          </div>
        )}
      </div>

      {/* Footer Timestamp & Action Buttons */}
      <div className="pt-3.5 border-t border-border flex items-center justify-between text-[13px] text-text-muted gap-2">
        <div 
          className="flex items-center gap-1.5 min-w-0"
          title={lastAttempt ? `Last Attempt: ${formatExactTime(lastAttempt.scraped_at)}` : 'Never synced'}
        >
          <Clock className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          <span className="truncate">
            {lastAttempt ? `Updated ${formatRelativeTime(lastAttempt.scraped_at)}` : 'Never scraped'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Scrape now Button */}
          {onRetrack && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRetrack(product.id);
              }}
              disabled={isRetracking}
              title="Trigger fresh scrape"
              aria-label="Scrape now"
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg badge-accent hover:bg-accent/20 transition-all flex items-center justify-center disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <RefreshCw className={`w-4 h-4 flex-shrink-0 ${isRetracking ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* External Merchant Store Link */}
          {extId && (
            <a
              href={`https://demo.inelabteamdev.com/product/${extId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open in store"
              aria-label="Open in store"
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-surface-2 text-text-muted border border-border hover:text-text hover:border-accent-border transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
            </a>
          )}

          {/* Untrack Button (Danger on hover only) */}
          {onUntrack && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUntrack(product.id, product.name);
              }}
              title="Untrack product"
              aria-label="Untrack product"
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-surface-2 text-text-muted border border-border hover:bg-danger-bg hover:text-danger hover:border-danger-border transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
