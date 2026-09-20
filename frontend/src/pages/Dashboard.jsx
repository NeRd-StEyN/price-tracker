import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Box, CheckCircle2, XCircle, HelpCircle, ActivitySquare, 
  RefreshCw, Search, SlidersHorizontal, ChevronDown, Trash2, RotateCw 
} from 'lucide-react';
import { 
  getProducts, getStats, retrackProduct, untrackProduct, 
  retrackAllProducts, untrackAllProducts 
} from '../api';
import { LoadingSkeleton, ErrorState, EmptyState } from '../components/StateComponents';
import ProductCard from '../components/ProductCard';

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, delay = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="glass-panel p-5 rounded-2xl flex items-center justify-between border border-white/10 relative overflow-hidden group shadow-lg"
  >
    <div>
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-extrabold text-white tracking-tight">{value}</h3>
      {subtext && <p className="text-[11px] text-slate-400 mt-1 font-medium">{subtext}</p>}
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colorClass} transition-transform duration-300 group-hover:scale-105`}>
      <Icon className="w-6 h-6" />
    </div>
  </motion.div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retrackingAll, setRetrackingAll] = useState(false);
  const [untrackingAll, setUntrackingAll] = useState(false);
  const [retrackingIds, setRetrackingIds] = useState(new Set());
  const [toastMessage, setToastMessage] = useState(null);

  // Filters & Sorting
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_stock' | 'out_of_stock' | 'unknown' | 'failing'
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'price_asc' | 'price_desc' | 'biggest_drop' | 'name'
  const [displayCount, setDisplayCount] = useState(12);

  const navigate = useNavigate();

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [statsData, productsData] = await Promise.all([
        getStats(),
        getProducts()
      ]);
      setStats(statsData);
      setProducts(productsData);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const intervalId = setInterval(() => loadData(false), 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Single Retrack Handler
  const handleRetrackSingle = async (productId) => {
    setRetrackingIds(prev => new Set(prev).add(productId));
    try {
      await retrackProduct(productId);
      showToast('Product rescraped successfully');
      await loadData(false);
    } catch (err) {
      showToast(`Retrack failed: ${err.message}`);
    } finally {
      setRetrackingIds(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  // Single Untrack / Delete Handler
  const handleUntrackSingle = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to untrack "${productName || 'this product'}"?`)) return;

    try {
      await untrackProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      showToast('Product untracked successfully');
      loadData(false);
    } catch (err) {
      showToast(`Untrack failed: ${err.message}`);
    }
  };

  // Retrack All Handler
  const handleRetrackAll = async () => {
    setRetrackingAll(true);
    try {
      await retrackAllProducts();
      showToast('Retrack requested for all products');
      await loadData(false);
    } catch (err) {
      showToast(`Retrack All failed: ${err.message}`);
    } finally {
      setRetrackingAll(false);
    }
  };

  // Untrack All / Delete All Handler
  const handleUntrackAll = async () => {
    if (!window.confirm('CAUTION: Are you sure you want to UNTRACK & DELETE ALL products? This action cannot be undone.')) {
      return;
    }

    setUntrackingAll(true);
    try {
      await untrackAllProducts();
      setProducts([]);
      showToast('All products untracked');
      await loadData(false);
    } catch (err) {
      showToast(`Delete All failed: ${err.message}`);
    } finally {
      setUntrackingAll(false);
    }
  };

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Text Filter (name, brand, sku, category)
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = p.name && p.name.toLowerCase().includes(q);
        const matchBrand = p.brand && p.brand.toLowerCase().includes(q);
        const matchSku = p.sku && p.sku.toLowerCase().includes(q);
        const matchCategory = p.category && p.category.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchSku && !matchCategory) return false;
      }

      // Status Filter
      if (statusFilter === 'in_stock') return p.stock_state === 'in_stock';
      if (statusFilter === 'out_of_stock') return p.stock_state === 'out_of_stock';
      if (statusFilter === 'unknown') return p.stock_state === 'unknown';
      if (statusFilter === 'failing') return p.last_attempt && p.last_attempt.status === 'failed';

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') {
        const priceA = a.latest_good ? a.latest_good.price : Infinity;
        const priceB = b.latest_good ? b.latest_good.price : Infinity;
        return priceA - priceB;
      }
      if (sortBy === 'price_desc') {
        const priceA = a.latest_good ? a.latest_good.price : -1;
        const priceB = b.latest_good ? b.latest_good.price : -1;
        return priceB - priceA;
      }
      if (sortBy === 'biggest_drop') {
        const dropA = a.price_change_pct !== null ? a.price_change_pct : 0;
        const dropB = b.price_change_pct !== null ? b.price_change_pct : 0;
        return dropA - dropB; // Most negative drop first
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // 'recent' default sort
      const timeA = a.last_attempt ? new Date(a.last_attempt.scraped_at).getTime() : 0;
      const timeB = b.last_attempt ? new Date(b.last_attempt.scraped_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [products, searchFilter, statusFilter, sortBy]);

  const visibleProducts = filteredProducts.slice(0, displayCount);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => loadData(true)} />;
  if (products.length === 0) {
    return (
      <EmptyState 
        title="No products tracked yet" 
        description="Search store items and add them to your surveillance tracker to monitor prices and stock availability in real-time."
        actionText="Search & Track Products"
        onAction={() => navigate('/search')}
      />
    );
  }

  return (
    <div className="flex flex-col w-full relative">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 right-6 z-50 px-4 py-3 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-2xl backdrop-blur-xl flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
        </motion.div>
      )}

      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Surveillance <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">Dashboard</span>
          </h1>
          <p className="text-slate-400 text-sm">Real-time marketplace price tracking & automated telemetry monitoring.</p>
        </div>

        {/* Global Action Toolbar: Refresh, Retrack All, Delete All */}
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-panel text-slate-200 text-xs font-semibold hover:border-emerald-500/40 hover:text-white transition-all shadow-md disabled:opacity-50"
            title="Refresh dashboard stats & data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button 
            onClick={handleRetrackAll}
            disabled={retrackingAll}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all shadow-md disabled:opacity-50"
            title="Trigger rescrape for all tracked products"
          >
            <RotateCw className={`w-3.5 h-3.5 text-emerald-400 ${retrackingAll ? 'animate-spin' : ''}`} />
            <span>{retrackingAll ? 'Rescraping All...' : 'Retrack All'}</span>
          </button>

          <button 
            onClick={handleUntrackAll}
            disabled={untrackingAll}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all shadow-md disabled:opacity-50"
            title="Delete / Untrack all products from database"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>{untrackingAll ? 'Deleting All...' : 'Delete All'}</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard 
          title="Tracked" 
          value={stats?.tracked ?? products.length} 
          subtext="Total items monitored"
          icon={Box} 
          colorClass="bg-slate-800/80 text-white border-white/10"
          delay={0.05}
        />
        <StatCard 
          title="In Stock" 
          value={stats?.in_stock ?? 0} 
          subtext="Available units"
          icon={CheckCircle2} 
          colorClass="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          delay={0.1}
        />
        <StatCard 
          title="Out of Stock" 
          value={stats?.out_of_stock ?? 0} 
          subtext="Unavailable"
          icon={XCircle} 
          colorClass="bg-rose-500/10 text-rose-400 border-rose-500/20"
          delay={0.15}
        />
        <StatCard 
          title="Unknown" 
          value={stats?.unknown ?? 0} 
          subtext="Never scraped"
          icon={HelpCircle} 
          colorClass="bg-slate-800 text-slate-400 border-white/10"
          delay={0.2}
        />
        <StatCard 
          title="Sync Success (7d)" 
          value={`${stats?.success_rate_7d ?? 0}%`} 
          subtext={`${stats?.attempts_7d ?? 0} total attempts`}
          icon={ActivitySquare} 
          colorClass="bg-teal-500/10 text-teal-300 border-teal-500/20"
          delay={0.25}
        />
      </div>

      {/* Toolbar: Text Filter, Status Filter Chips, Sorting */}
      <div className="glass-panel p-4 rounded-2xl mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border border-white/10">
        
        {/* Text Filter */}
        <div className="relative flex-grow max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter by name, brand, SKU..."
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { key: 'all', label: 'All' },
            { key: 'in_stock', label: 'In stock' },
            { key: 'out_of_stock', label: 'Out of stock' },
            { key: 'unknown', label: 'Unknown' },
            { key: 'failing', label: 'Failing' }
          ].map(chip => (
            <button
              key={chip.key}
              onClick={() => setStatusFilter(chip.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                statusFilter === chip.key
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/40 text-slate-400 border-white/10 hover:text-slate-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 hidden lg:block" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-900/60 text-slate-200 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500/50 cursor-pointer"
          >
            <option value="recent">Recently Scraped</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="biggest_drop">Biggest Price Drop</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Product Cards Grid */}
      {filteredProducts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {visibleProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onRetrack={handleRetrackSingle}
                onUntrack={handleUntrackSingle}
                isRetracking={retrackingIds.has(product.id)}
              />
            ))}
          </div>

          {/* Pagination / Load More */}
          {displayCount < filteredProducts.length && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setDisplayCount(prev => prev + 12)}
                className="px-8 py-3 rounded-xl glass-panel text-sm font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-all shadow-lg flex items-center gap-2"
              >
                <span>Load More Products ({filteredProducts.length - displayCount} remaining)</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="glass-panel p-12 rounded-3xl text-center border border-dashed border-white/15 my-6">
          <p className="text-slate-400 text-sm">No tracked products match the selected filters.</p>
        </div>
      )}
    </div>
  );
}
