import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, Loader2, CheckCircle2, Plus, ArrowRight } from 'lucide-react';
import { searchProducts, trackProduct, getProducts } from '../api';
import { ErrorState } from '../components/StateComponents';
import { getCategoryIcon } from '../utils';

export default function Search() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [trackedMap, setTrackedMap] = useState(new Map()); // Maps external_id/id to product_id
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trackingId, setTrackingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Category filter state & pagination
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [displayCount, setDisplayCount] = useState(12);

  const navigate = useNavigate();

  // Load existing tracked products to calculate "Tracked" state
  const loadTrackedProducts = async () => {
    try {
      const tracked = await getProducts();
      const map = new Map();
      tracked.forEach(p => {
        const ext = String(p.external_id || '').replace(/[^0-9]/g, '');
        if (ext) map.set(ext, p.id);
        map.set(String(p.id), p.id);
      });
      setTrackedMap(map);
    } catch (err) {
      console.error('Failed to load tracked products map:', err);
    }
  };

  useEffect(() => {
    loadTrackedProducts();
  }, []);

  // 300ms Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    const controller = new AbortController();
    
    searchProducts(debouncedQuery, controller.signal)
      .then(data => {
        setResults(data);
        setDisplayCount(12);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
      
    return () => controller.abort();
  }, [debouncedQuery]);

  // Handle tracking a search result item
  const handleTrackItem = async (product) => {
    setTrackingId(product.id);
    try {
      const extId = product.external_id || product.id;
      const res = await trackProduct(
        product.name,
        product.url,
        null,
        product.brand,
        product.sku,
        product.category,
        product.description,
        product.specs
      );

      const createdId = res.product ? res.product.id : res.id;
      setTrackedMap(prev => {
        const newMap = new Map(prev);
        newMap.set(String(extId), createdId);
        newMap.set(String(product.id), createdId);
        return newMap;
      });

      setToastMessage(`"${product.name}" added to surveillance watchlist!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      alert(`Failed to track product: ${err.message}`);
    } finally {
      setTrackingId(null);
    }
  };

  // Extract real categories from search results
  const availableCategories = useMemo(() => {
    const categories = new Set(['All']);
    results.forEach(r => {
      if (r.category) categories.add(r.category);
    });
    return Array.from(categories);
  }, [results]);

  // Filter results by category
  const filteredResults = useMemo(() => {
    if (selectedCategory === 'All') return results;
    return results.filter(r => r.category === selectedCategory);
  }, [results, selectedCategory]);

  const visibleResults = filteredResults.slice(0, displayCount);

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto">
      {/* Toast Feedback Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-50 glass-panel badge-accent px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border"
          >
            <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-text tracking-tight mb-3">
          Discover & <span className="text-accent">Track Catalog Items</span>
        </h1>
        <p className="text-text-muted text-sm md:text-base max-w-xl mx-auto">
          Search store products by name, brand, SKU, category, or Product ID to start monitoring prices and stock updates.
        </p>
      </div>

      {/* Single Main Search Bar */}
      <div className="relative max-w-3xl mx-auto w-full mb-8">
        <div className="glass-panel rounded-[12px] p-2 flex items-center border border-border shadow-lg">
          <div className="pl-4 pr-3 text-text-muted">
            <SearchIcon className="w-5 h-5 text-accent" />
          </div>
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product name, brand, SKU, category, or Product ID..."
            className="w-full bg-transparent border-none py-3 text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-0"
          />
          {loading && (
            <div className="pr-4 text-accent">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Category Filter Chips & Result Counter */}
      {results.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                  selectedCategory === cat
                    ? 'badge-accent shadow-sm'
                    : 'bg-surface-2 text-text-muted border-border hover:text-text'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <span className="text-xs text-text-muted font-medium whitespace-nowrap">
            Showing {filteredResults.length} catalog {filteredResults.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      )}

      {/* Error State */}
      {error ? (
        <ErrorState error={error} onRetry={() => setDebouncedQuery(query)} />
      ) : results.length > 0 ? (
        <>
          {/* Results Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {visibleResults.map((product) => {
              const CategoryIcon = getCategoryIcon(product.category);
              const extId = String(product.external_id || product.id).replace(/[^0-9]/g, '');
              const trackedProductId = trackedMap.get(extId) || trackedMap.get(String(product.id));
              const isTracked = Boolean(trackedProductId);
              const isTracking = trackingId === product.id;

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-panel p-5 rounded-[12px] flex flex-col justify-between border border-border shadow-md"
                >
                  <div>
                    {/* Top Row: Category Icon & SKU */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-accent">
                        <CategoryIcon className="w-5 h-5 text-accent" />
                      </div>
                      <span className="text-xs font-mono text-text-muted bg-surface-2 px-2 py-1 rounded-md border border-border">
                        {product.sku || `ID #${product.id}`}
                      </span>
                    </div>

                    {/* Brand Badge */}
                    {product.brand && (
                      <span className="text-[13px] font-semibold text-accent uppercase tracking-wider block mb-1">
                        {product.brand}
                      </span>
                    )}

                    {/* Name */}
                    <h3 className="font-bold text-text text-base leading-snug line-clamp-2 mb-4">
                      {product.name}
                    </h3>
                  </div>

                  {/* Track / Tracked Button */}
                  <div className="pt-3 border-t border-border">
                    {isTracked ? (
                      <div className="flex items-center gap-2">
                        <button
                          disabled
                          className="flex-1 py-2.5 rounded-xl badge-neutral text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
                        >
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          <span>Tracked</span>
                        </button>
                        <Link
                          to={`/product/${trackedProductId}`}
                          className="px-3.5 py-2.5 rounded-xl badge-accent hover:bg-accent/20 text-xs font-semibold transition-all flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                          title="View product detail"
                          aria-label="View product detail"
                        >
                          <span>View</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleTrackItem(product)}
                        disabled={isTracking}
                        className="w-full py-2.5 rounded-xl bg-accent text-bg font-bold text-xs shadow-md hover:bg-accent/90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        title="Add to surveillance watchlist"
                        aria-label="Track product"
                      >
                        {isTracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        <span>{isTracking ? 'Tracking...' : 'Track'}</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Load More Pagination */}
          {displayCount < filteredResults.length && (
            <div className="flex justify-center mb-12">
              <button
                onClick={() => setDisplayCount(prev => prev + 12)}
                className="px-8 py-3 rounded-xl glass-panel text-xs font-semibold text-accent border border-accent-border hover:bg-accent/10 transition-all shadow-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                Load More Results ({filteredResults.length - displayCount} remaining)
              </button>
            </div>
          )}
        </>
      ) : debouncedQuery.trim() && !loading ? (
        <div className="glass-panel p-10 rounded-[12px] text-center border border-dashed border-border my-6 max-w-2xl mx-auto">
          <p className="text-text font-semibold text-base mb-2">No products match "{debouncedQuery}"</p>
          <p className="text-text-muted text-xs leading-relaxed">
            Try searching for terms like "Nordkraft", "Monitor", "Headphones", "Audio", "Laptops", or a numeric product ID.
          </p>
        </div>
      ) : (
        /* Default / Initial Search State */
        <div className="glass-panel p-10 rounded-[12px] text-center border border-border my-4 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl badge-accent flex items-center justify-center mx-auto mb-4">
            <SearchIcon className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-lg font-bold text-text mb-2">Search Store Catalog</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
            Type any keyword, brand, SKU, category, or Product ID in the search box above to browse available store items.
          </p>
        </div>
      )}
    </div>
  );
}
