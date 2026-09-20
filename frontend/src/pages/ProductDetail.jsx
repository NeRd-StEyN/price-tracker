import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { 
  ArrowLeft, ExternalLink, Clock, Trash2, AlertTriangle, TrendingUp, TrendingDown, 
  Target, Activity, RefreshCw, Star, ShieldCheck, Truck, Store, Layers, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';

import { 
  getProductDetail, getProductHistory, getProductLogs, retrackProduct, updateScrapeInterval, untrackProduct 
} from '../api';
import { LoadingSkeleton, ErrorState, EmptyState } from '../components/StateComponents';
import { formatRelativeTime, formatExactTime, formatPrice, mapErrorToFriendlyText, getCategoryIcon } from '../utils';
import { StockBadge, StatusBadge, PriceChangeChip } from '../components/Badges';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Controls & Action states
  const [scraping, setScraping] = useState(false);
  const [scrapeResultInline, setScrapeResultInline] = useState(null);
  const [updatingInterval, setUpdatingInterval] = useState(false);
  const [untracking, setUntracking] = useState(false);

  // Chart range filter
  const [chartRange, setChartRange] = useState('7d'); // '24h' | '7d' | '30d' | 'all'

  // Log filter & Expandable row state
  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'logs' | 'specs'

  const fetchData = async () => {
    try {
      const prod = await getProductDetail(id);
      setProduct(prod);

      const [histData, logsData] = await Promise.all([
        getProductHistory(id, chartRange),
        getProductLogs(id, 50, logStatusFilter)
      ]);

      setHistory(histData || []);
      setLogs(logsData || []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, chartRange, logStatusFilter]);

  // Handle Manual Scrape / Retrack
  const handleScrapeNow = async () => {
    setScraping(true);
    setScrapeResultInline(null);
    try {
      const log = await retrackProduct(id);
      setScrapeResultInline(log);
      await fetchData();
    } catch (err) {
      alert(`Scrape failed: ${err.message}`);
    } finally {
      setScraping(false);
    }
  };

  // Handle Interval Change
  const handleIntervalChange = async (e) => {
    const val = Number(e.target.value);
    setUpdatingInterval(true);
    try {
      const updated = await updateScrapeInterval(id, val);
      setProduct(prev => ({ ...prev, scrape_interval_minutes: updated.scrape_interval_minutes }));
    } catch (err) {
      alert(`Failed to update scrape interval: ${err.message}`);
    } finally {
      setUpdatingInterval(false);
    }
  };

  // Handle Untrack
  const handleUntrack = async () => {
    if (!window.confirm(`Are you sure you want to stop tracking "${product?.name}"?`)) return;
    setUntracking(true);
    try {
      await untrackProduct(id);
      navigate('/');
    } catch (err) {
      alert(`Failed to untrack: ${err.message}`);
      setUntracking(false);
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={fetchData} />;
  if (!product) return <EmptyState title="Not Found" description="Could not load product details." />;

  const latestGood = product.latest_good;
  const lastAttempt = product.last_attempt;
  const CategoryIcon = getCategoryIcon(product.category);
  const extId = String(product.external_id || '').replace(/[^0-9]/g, '');

  // Calculate discount percentage if MRP exists
  let discountPct = null;
  if (latestGood?.mrp && latestGood?.price && latestGood.mrp > latestGood.price) {
    discountPct = Math.round(((latestGood.mrp - latestGood.price) / latestGood.mrp) * 100);
  }

  // Format Recharts data for Price Trajectory (good reads only, oldest first)
  const chartData = history.map(h => ({
    time: new Date(h.scraped_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    price: parseFloat(h.price),
    inStock: h.in_stock,
    stockUnits: h.stock_units,
    scrapedAt: h.scraped_at
  }));

  // Identify out-of-stock data points on chart
  const outOfStockPoints = chartData.filter(d => !d.inStock);

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 w-fit transition-colors text-sm font-semibold"
      >
        <ArrowLeft className="w-4 h-4 text-emerald-400" />
        <span>Back to Dashboard</span>
      </button>

      {/* Warning Banner if Last Attempt Failed */}
      {lastAttempt && lastAttempt.status === 'failed' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 glass-panel border-rose-500/30 bg-rose-500/10 text-rose-200 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border shadow-xl"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-white">
                Last Sync Attempt Failed: {mapErrorToFriendlyText(lastAttempt.error_code, lastAttempt.message)}
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                {latestGood 
                  ? `Showing last good read from ${formatRelativeTime(latestGood.scraped_at)} (${formatExactTime(latestGood.scraped_at)}).`
                  : 'No successful price read has ever occurred for this product.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleScrapeNow}
            disabled={scraping}
            className="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-200 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500 hover:text-white transition-all shadow-md w-fit flex-shrink-0"
          >
            Retry Sync Now
          </button>
        </motion.div>
      )}

      {/* Inline Scrape Result Notification */}
      <AnimatePresence>
        {scrapeResultInline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 p-4 rounded-2xl border text-xs font-medium flex items-center justify-between gap-4 shadow-xl ${
              scrapeResultInline.status === 'success' || scrapeResultInline.status === 'retried'
                ? 'glass-panel border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'glass-panel border-rose-500/30 bg-rose-500/10 text-rose-200'
            }`}
          >
            <div>
              <span className="font-bold uppercase tracking-wider mr-2">[{scrapeResultInline.status}]</span>
              <span>Attempts: {scrapeResultInline.attempts} • Duration: {scrapeResultInline.duration_ms || 0}ms</span>
              <p className="mt-1 text-slate-300">{mapErrorToFriendlyText(scrapeResultInline.error_code, scrapeResultInline.message)}</p>
            </div>
            <button onClick={() => setScrapeResultInline(null)} className="text-slate-400 hover:text-white">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Product Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        
        {/* Left Card: Category Icon & Metadata */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-3xl flex flex-col justify-between border border-white/10 relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-3 mb-6">
              <span className="px-3 py-1 bg-slate-900/80 text-slate-300 text-xs font-mono font-semibold rounded-full border border-white/10 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                {product.sku || `ID #${product.external_id}`}
              </span>

              <StockBadge stockState={product.stock_state} stockUnits={latestGood?.stock_units} />
            </div>

            {/* Category Icon Container */}
            <div className="w-full aspect-video bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center p-6 border border-white/10 mb-6 shadow-inner">
              <CategoryIcon className="w-16 h-16 text-emerald-400 mb-2" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{product.category || 'General'}</span>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-xs text-slate-300 leading-relaxed mb-6 font-normal">
                {product.description}
              </p>
            )}
          </div>

          {/* External Store Link Button */}
          <a 
            href={`https://demo.inelabteamdev.com/product/${extId}`}
            target="_blank" 
            rel="noopener noreferrer" 
            className="w-full py-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white transition-all text-sm shadow-lg"
          >
            <span>Open in Merchant Store</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Right Card: Price Panel & Metadata Grid */}
        <div className="lg:col-span-8 flex flex-col justify-between glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden">
          <div className="relative z-10">
            {/* Brand & Category */}
            <div className="flex items-center gap-3 mb-3">
              {product.brand && (
                <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-md border border-emerald-500/20">
                  {product.brand}
                </span>
              )}
              <StatusBadge status={lastAttempt?.status} />
            </div>

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-snug mb-6">
              {product.name}
            </h1>

            {/* Price Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 block">Current Price (Latest Good)</span>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {formatPrice(latestGood?.price)}
                  </span>
                  {latestGood?.mrp && latestGood.mrp > latestGood.price && (
                    <span className="text-xs text-slate-500 line-through">
                      {formatPrice(latestGood.mrp)}
                    </span>
                  )}
                  {discountPct && (
                    <span className="text-xs font-bold text-emerald-400">
                      {discountPct}% OFF
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> Lowest Recorded
                </span>
                <span className="text-2xl font-extrabold text-emerald-400 tracking-tight">
                  {formatPrice(product.min_price)}
                </span>
              </div>

              <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Highest Recorded
                </span>
                <span className="text-2xl font-extrabold text-slate-300 tracking-tight">
                  {formatPrice(product.max_price)}
                </span>
              </div>
            </div>

            {/* Merchant Store Telemetry Metadata (Rating, Seller, Delivery, Stock Units) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-900/40 border border-white/5 mb-6 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Rating</span>
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {latestGood?.rating || '3.5'} ({latestGood?.rating_count || 120})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Seller</span>
                <span className="font-bold text-slate-200 truncate block">
                  {latestGood?.seller || 'Authorized Merchant'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Est. Delivery</span>
                <span className="font-bold text-slate-200">
                  {latestGood?.delivery_days ? `${latestGood.delivery_days} days` : '2-4 business days'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Available Units</span>
                <span className="font-bold text-emerald-400">
                  {latestGood?.stock_units ? `${latestGood.stock_units} units` : (latestGood?.in_stock ? 'In stock' : '0 units')}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar: Scrape Now, Interval Select, Untrack */}
          <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={handleScrapeNow}
                disabled={scraping}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500 hover:text-white transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scraping ? 'animate-spin' : ''}`} />
                <span>{scraping ? 'Scraping...' : 'Scrape Now'}</span>
              </button>

              {/* Interval Select */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Interval:</span>
                <select
                  value={product.scrape_interval_minutes}
                  onChange={handleIntervalChange}
                  disabled={updatingInterval}
                  className="bg-slate-900 border border-white/10 text-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={60}>1h</option>
                  <option value={120}>2h</option>
                  <option value={360}>6h</option>
                  <option value={720}>12h</option>
                  <option value={1440}>24h</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleUntrack}
              disabled={untracking}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-semibold hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{untracking ? 'Untracking...' : 'Untrack'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Price Analytics Trajectory Chart */}
      <div className="glass-panel p-8 rounded-3xl mb-8 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Price & Stock Trajectory</h2>
            <p className="text-xs text-slate-400">Historical pricing trajectory (Good reads only)</p>
          </div>

          {/* Range Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/10">
            {['24h', '7d', '30d', 'all'].map(r => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  chartRange === r
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {chartData.length >= 2 ? (
          <div className="h-[340px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `₹${val}`} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', color: '#fff' }}
                  itemStyle={{ color: '#34D399', fontWeight: 'bold' }}
                  labelStyle={{ color: '#94A3B8', marginBottom: '4px', fontSize: '11px' }}
                  formatter={(value, name, item) => [
                    `₹${value} (${item.payload.inStock ? 'In Stock' : 'Out of Stock'})`, 
                    'Price'
                  ]}
                />
                <Area type="monotone" dataKey="price" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }} />

                {/* Markers where stock hit 0 */}
                {outOfStockPoints.map((pt, idx) => (
                  <ReferenceDot 
                    key={idx} 
                    x={pt.time} 
                    y={pt.price} 
                    r={6} 
                    fill="#F43F5E" 
                    stroke="#FFFFFF" 
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 bg-slate-900/40 rounded-2xl border border-dashed border-white/10">
            <Activity className="w-8 h-8 mb-2 opacity-50 text-emerald-400" />
            <p className="text-xs">Not enough data yet (need 2+ readings)</p>
          </div>
        )}
      </div>

      {/* Detail Tabs: Price & Stock History | Scrape Log | Technical Specs */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10">
        <div className="flex items-center gap-4 border-b border-white/10 pb-4 mb-6">
          <button
            onClick={() => setActiveTab('history')}
            className={`text-sm font-bold pb-1 transition-all ${
              activeTab === 'history' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Price & Stock History ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`text-sm font-bold pb-1 transition-all ${
              activeTab === 'logs' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Scrape Log ({logs.length})
          </button>
          {product.specs && Object.keys(product.specs).length > 0 && (
            <button
              onClick={() => setActiveTab('specs')}
              className={`text-sm font-bold pb-1 transition-all ${
                activeTab === 'specs' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              Technical Specs
            </button>
          )}
        </div>

        {/* TAB 1: Price & Stock History Table */}
        {activeTab === 'history' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="pb-3 px-3">Time</th>
                  <th className="pb-3 px-3">Price</th>
                  <th className="pb-3 px-3">MRP</th>
                  <th className="pb-3 px-3">Stock Units</th>
                  <th className="pb-3 px-3">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-900/40">
                    <td className="py-3 px-3 font-mono text-slate-300" title={formatExactTime(row.scraped_at)}>
                      {formatRelativeTime(row.scraped_at)}
                    </td>
                    <td className="py-3 px-3 font-bold text-white">{formatPrice(row.price)}</td>
                    <td className="py-3 px-3 text-slate-400">{row.mrp ? formatPrice(row.mrp) : '—'}</td>
                    <td className="py-3 px-3 text-slate-300">{row.stock_units ?? (row.in_stock ? 'Available' : '0')}</td>
                    <td className="py-3 px-3">
                      <StockBadge stockState={row.in_stock ? 'in_stock' : 'out_of_stock'} stockUnits={row.stock_units} />
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-500">No good price history readings recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: Scrape Log Table with Filter & Expandable Technical Row */}
        {activeTab === 'logs' && (
          <div>
            {/* Status Filter */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-400 font-medium">Filter Log Status:</span>
              {['', 'success', 'retried', 'failed'].map(st => (
                <button
                  key={st}
                  onClick={() => setLogStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize border ${
                    logStatusFilter === st
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900/40 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  {st || 'All'}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="pb-3 px-3">Time</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3">Attempts</th>
                    <th className="pb-3 px-3">Duration</th>
                    <th className="pb-3 px-3">Message</th>
                    <th className="pb-3 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const friendlyMsg = mapErrorToFriendlyText(log.error_code, log.message);

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-slate-900/40">
                          <td className="py-3 px-3 font-mono text-slate-300" title={formatExactTime(log.scraped_at)}>
                            {formatRelativeTime(log.scraped_at)}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={log.status} />
                          </td>
                          <td className="py-3 px-3 text-slate-300">{log.attempts}</td>
                          <td className="py-3 px-3 text-slate-400">{log.duration_ms ? `${log.duration_ms}ms` : '—'}</td>
                          <td className="py-3 px-3 font-medium text-slate-200">{friendlyMsg}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-slate-400 hover:text-white flex items-center gap-1"
                            >
                              <span>{isExpanded ? 'Hide' : 'Raw'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Technical Details Row */}
                        {isExpanded && (
                          <tr className="bg-slate-900/80">
                            <td colSpan={6} className="p-4 border-b border-white/10">
                              <div className="bg-slate-950 p-3 rounded-xl border border-white/10 text-slate-300 font-mono text-[11px] leading-relaxed">
                                <p className="text-slate-400 mb-1 font-sans font-bold uppercase tracking-wider text-[10px]">Technical Log Dump:</p>
                                <p><strong>Error Code:</strong> {log.error_code || 'NONE'}</p>
                                <p><strong>Raw Message:</strong> {log.message}</p>
                                <p><strong>Attempts Count:</strong> {log.attempts}</p>
                                <p><strong>Scraped At:</strong> {log.scraped_at}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-500">No scrape telemetry logs available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Technical Specs */}
        {activeTab === 'specs' && product.specs && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(product.specs).map(([key, value]) => (
              <div key={key} className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex flex-col justify-center">
                <span className="text-xs text-slate-400 font-semibold capitalize mb-1">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="text-sm font-bold text-white">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
