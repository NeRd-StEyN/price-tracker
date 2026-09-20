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

  const [scraping, setScraping] = useState(false);
  const [scrapeResultInline, setScrapeResultInline] = useState(null);
  const [updatingInterval, setUpdatingInterval] = useState(false);
  const [untracking, setUntracking] = useState(false);

  const [chartRange, setChartRange] = useState('7d'); 

  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const [activeTab, setActiveTab] = useState('history'); 

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

  const isStale = Boolean(lastAttempt && lastAttempt.status === 'failed' && latestGood);

  let discountPct = null;
  if (latestGood?.mrp && latestGood?.price && latestGood.mrp > latestGood.price) {
    discountPct = Math.round(((latestGood.mrp - latestGood.price) / latestGood.mrp) * 100);
  }

  const chartData = history.map(h => ({
    time: new Date(h.scraped_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    price: parseFloat(h.price),
    inStock: h.in_stock,
    stockUnits: h.stock_units,
    scrapedAt: h.scraped_at
  }));

  const outOfStockPoints = chartData.filter(d => !d.inStock);

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto">
      {}
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-text-muted hover:text-text mb-6 w-fit transition-colors text-sm font-semibold focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded-lg p-1"
      >
        <ArrowLeft className="w-4 h-4 text-accent" />
        <span>Back to Dashboard</span>
      </button>

      {}
      {lastAttempt && lastAttempt.status === 'failed' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 glass-panel badge-danger p-5 rounded-[12px] flex flex-col md:flex-row md:items-center justify-between gap-4 border shadow-md"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-text">
                Last Sync Attempt Failed: {mapErrorToFriendlyText(lastAttempt.error_code, lastAttempt.message)}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {latestGood 
                  ? `Stale — showing last good read from ${formatRelativeTime(latestGood.scraped_at)} (${formatExactTime(latestGood.scraped_at)}).`
                  : 'No successful price read has ever occurred for this product.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleScrapeNow}
            disabled={scraping}
            className="px-4 py-2 rounded-xl badge-danger text-xs font-semibold hover:bg-danger hover:text-bg transition-all shadow-sm w-fit flex-shrink-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Retry Sync Now
          </button>
        </motion.div>
      )}

      {}
      <AnimatePresence>
        {scrapeResultInline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 p-4 rounded-[12px] border text-xs font-medium flex items-center justify-between gap-4 shadow-md ${
              scrapeResultInline.status === 'success' ? 'badge-success' : 'badge-warning'
            }`}
          >
            <div>
              <span className="font-bold uppercase tracking-wider mr-2">[{scrapeResultInline.status}]</span>
              <span>Attempts: {scrapeResultInline.attempts} • Duration: {scrapeResultInline.duration_ms || 0}ms</span>
              <p className="mt-1">{mapErrorToFriendlyText(scrapeResultInline.error_code, scrapeResultInline.message)}</p>
            </div>
            <button onClick={() => setScrapeResultInline(null)} className="text-text-muted hover:text-text">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        
        {}
        <div className="lg:col-span-4 glass-panel p-6 rounded-[12px] flex flex-col justify-between border border-border relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-3 mb-6">
              <span className="px-3 py-1 bg-surface-2 text-text-muted text-xs font-mono font-semibold rounded-full border border-border flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-accent" />
                {product.sku || `ID #${product.external_id}`}
              </span>

              <StockBadge stockState={product.stock_state} stockUnits={latestGood?.stock_units} />
            </div>

            {}
            <div className="w-full aspect-video bg-surface-2 rounded-xl flex flex-col items-center justify-center p-6 border border-border mb-6 shadow-inner">
              <CategoryIcon className="w-16 h-16 text-accent mb-2" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">{product.category || 'General'}</span>
            </div>

            {}
            {product.description && (
              <p className="text-xs text-text-muted leading-relaxed mb-6 font-normal">
                {product.description}
              </p>
            )}
          </div>

          {}
          <a 
            href={`https://demo.inelabteamdev.com/product/${extId}`}
            target="_blank" 
            rel="noopener noreferrer" 
            className="w-full py-3 h-11 badge-accent rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-accent/20 transition-all text-sm shadow-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            title="Open in store"
            aria-label="Open in store"
          >
            <span>Open in Merchant Store</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {}
        <div className="lg:col-span-8 flex flex-col justify-between glass-panel p-8 rounded-[12px] border border-border relative overflow-hidden">
          <div className="relative z-10">
            {}
            <div className="flex items-center gap-3 mb-3">
              {product.brand && (
                <span className="text-xs font-extrabold uppercase tracking-widest badge-accent px-3 py-1 rounded-md">
                  {product.brand}
                </span>
              )}
              <StatusBadge status={lastAttempt?.status} />
            </div>

            {}
            <h1 className="text-3xl lg:text-4xl font-extrabold text-text tracking-tight leading-snug mb-6">
              {product.name}
            </h1>

            {}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface-2 border border-border p-5 rounded-xl">
                <span className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-1 block">Current Price</span>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={`text-3xl font-extrabold tracking-tight tabular-nums ${isStale ? 'text-text-muted opacity-80' : 'text-text'}`}>
                    {formatPrice(latestGood?.price)}
                  </span>
                  {latestGood?.mrp && latestGood.mrp > latestGood.price && (
                    <span className="text-xs text-text-muted line-through tabular-nums">
                      {formatPrice(latestGood.mrp)}
                    </span>
                  )}
                  {discountPct && (
                    <span className="text-xs font-bold badge-accent px-1.5 py-0.5 rounded">
                      {discountPct}% OFF
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-surface-2 border border-border p-5 rounded-xl">
                <span className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-success" /> Lowest Recorded
                </span>
                <span className="text-2xl font-extrabold text-success tracking-tight tabular-nums">
                  {formatPrice(product.min_price)}
                </span>
              </div>

              <div className="bg-surface-2 border border-border p-5 rounded-xl">
                <span className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-text-muted" /> Highest Recorded
                </span>
                <span className="text-2xl font-extrabold text-text tracking-tight tabular-nums">
                  {formatPrice(product.max_price)}
                </span>
              </div>
            </div>

            {}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface-2/60 border border-border mb-6 text-xs">
              <div>
                <span className="text-text-muted block mb-0.5">Rating</span>
                <span className="font-bold text-warning flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                  {latestGood?.rating || '3.5'} ({latestGood?.rating_count || 120})
                </span>
              </div>
              <div>
                <span className="text-text-muted block mb-0.5">Seller</span>
                <span className="font-bold text-text truncate block">
                  {latestGood?.seller || 'Authorized Merchant'}
                </span>
              </div>
              <div>
                <span className="text-text-muted block mb-0.5">Est. Delivery</span>
                <span className="font-bold text-text">
                  {latestGood?.delivery_days ? `${latestGood.delivery_days} days` : '2-4 business days'}
                </span>
              </div>
              <div>
                <span className="text-text-muted block mb-0.5">Available Units</span>
                <span className="font-bold text-success">
                  {latestGood?.stock_units && latestGood.stock_units > 1 ? `${latestGood.stock_units} units` : (latestGood?.in_stock ? 'In stock' : '0 units')}
                </span>
              </div>
            </div>
          </div>

          {}
          <div className="pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={handleScrapeNow}
                disabled={scraping}
                className="h-10 min-w-[40px] px-4 rounded-xl badge-accent text-xs font-semibold hover:bg-accent/20 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                title="Trigger fresh scrape"
                aria-label="Scrape now"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scraping ? 'animate-spin' : ''}`} />
                <span>{scraping ? 'Scraping...' : 'Scrape now'}</span>
              </button>

              {}
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <Clock className="w-3.5 h-3.5 text-text-muted" />
                <span>Interval:</span>
                <select
                  value={product.scrape_interval_minutes}
                  onChange={handleIntervalChange}
                  disabled={updatingInterval}
                  className="bg-surface-2 border border-border text-text rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-accent cursor-pointer"
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
              className="h-10 min-w-[40px] px-4 rounded-xl bg-surface-2 text-text-muted border border-border hover:bg-danger-bg hover:text-danger hover:border-danger-border text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              title="Untrack product"
              aria-label="Untrack product"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{untracking ? 'Untracking...' : 'Untrack'}</span>
            </button>
          </div>
        </div>
      </div>

      {}
      <div className="glass-panel p-8 rounded-[12px] mb-8 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-text mb-1">Price & Stock Trajectory</h2>
            <p className="text-xs text-text-muted">Historical pricing trajectory (Good reads only)</p>
          </div>

          {}
          <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-xl border border-border">
            {['24h', '7d', '30d', 'all'].map(r => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                  chartRange === r
                    ? 'badge-accent'
                    : 'text-text-muted hover:text-text'
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
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.08}/>
                    <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E4E4E7" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `₹${val}`} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '2px solid #000000', boxShadow: '4px 4px 0px rgba(0,0,0,1)', color: '#000000' }}
                  itemStyle={{ color: '#000000', fontWeight: 'bold' }}
                  labelStyle={{ color: '#71717A', marginBottom: '4px', fontSize: '11px' }}
                  formatter={(value, name, item) => [
                    `₹${value} (${item.payload.inStock ? 'In Stock' : 'Out of Stock'})`, 
                    'Price'
                  ]}
                />
                <Area type="monotone" dataKey="price" stroke="#000000" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" activeDot={{ r: 6, fill: '#000000', stroke: '#FFFFFF', strokeWidth: 2 }} />

                {}
                {outOfStockPoints.map((pt, idx) => (
                  <ReferenceDot 
                    key={idx} 
                    x={pt.time} 
                    y={pt.price} 
                    r={6} 
                    fill="#FCA5A5" 
                    stroke="#000000" 
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-text-muted bg-surface-2/40 rounded-xl border border-dashed border-border">
            <Activity className="w-8 h-8 mb-2 opacity-50 text-accent" />
            <p className="text-xs">Not enough data yet (need 2+ readings)</p>
          </div>
        )}
      </div>

      {}
      <div className="glass-panel p-6 rounded-[12px] border border-border">
        <div className="flex items-center gap-4 border-b border-border pb-4 mb-6">
          <button
            onClick={() => setActiveTab('history')}
            className={`text-sm font-bold pb-1 transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
              activeTab === 'history' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            Price & Stock History ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`text-sm font-bold pb-1 transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
              activeTab === 'logs' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            Scrape Log ({logs.length})
          </button>
          {product.specs && Object.keys(product.specs).length > 0 && (
            <button
              onClick={() => setActiveTab('specs')}
              className={`text-sm font-bold pb-1 transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                activeTab === 'specs' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text'
              }`}
            >
              Technical Specs
            </button>
          )}
        </div>

        {}
        {activeTab === 'history' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-muted uppercase tracking-wider font-semibold">
                  <th className="pb-3 px-3">Time</th>
                  <th className="pb-3 px-3">Price</th>
                  <th className="pb-3 px-3">MRP</th>
                  <th className="pb-3 px-3">Stock Units</th>
                  <th className="pb-3 px-3">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((row, i) => (
                  <tr key={i} className="hover:bg-surface-2/60">
                    <td className="py-3 px-3 font-mono text-text-muted tabular-nums" title={formatExactTime(row.scraped_at)}>
                      {formatRelativeTime(row.scraped_at)}
                    </td>
                    <td className="py-3 px-3 font-bold text-text tabular-nums">{formatPrice(row.price)}</td>
                    <td className="py-3 px-3 text-text-muted tabular-nums">{row.mrp ? formatPrice(row.mrp) : '—'}</td>
                    <td className="py-3 px-3 text-text tabular-nums">{row.stock_units ?? (row.in_stock ? 'Available' : '0')}</td>
                    <td className="py-3 px-3">
                      <StockBadge stockState={row.in_stock ? 'in_stock' : 'out_of_stock'} stockUnits={row.stock_units} />
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-text-muted">No good price history readings recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {}
        {activeTab === 'logs' && (
          <div>
            {}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-text-muted font-medium">Filter Log Status:</span>
              {['', 'success', 'retried', 'failed'].map(st => (
                <button
                  key={st}
                  onClick={() => setLogStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize border focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                    logStatusFilter === st
                      ? 'badge-accent'
                      : 'bg-surface-2 text-text-muted border-border hover:text-text'
                  }`}
                >
                  {st || 'All'}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-text-muted uppercase tracking-wider font-semibold">
                    <th className="pb-3 px-3">Time</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3">Attempts</th>
                    <th className="pb-3 px-3">Duration</th>
                    <th className="pb-3 px-3">Message</th>
                    <th className="pb-3 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const friendlyMsg = mapErrorToFriendlyText(log.error_code, log.message);

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-surface-2/60">
                          <td className="py-3 px-3 font-mono text-text-muted tabular-nums" title={formatExactTime(log.scraped_at)}>
                            {formatRelativeTime(log.scraped_at)}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={log.status} />
                          </td>
                          <td className="py-3 px-3 text-text tabular-nums">{log.attempts}</td>
                          <td className="py-3 px-3 text-text-muted tabular-nums">{log.duration_ms ? `${log.duration_ms}ms` : '—'}</td>
                          <td className="py-3 px-3 font-medium text-text">{friendlyMsg}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-text-muted hover:text-text flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded p-1"
                            >
                              <span>{isExpanded ? 'Hide' : 'Raw'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>

                        {}
                        {isExpanded && (
                          <tr className="bg-surface-2">
                            <td colSpan={6} className="p-4 border-b border-border">
                              <div className="bg-bg p-3 rounded-xl border border-border text-text font-mono text-[11px] leading-relaxed">
                                <p className="text-text-muted mb-1 font-sans font-bold uppercase tracking-wider text-[10px]">Technical Log Dump:</p>
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
                      <td colSpan={6} className="text-center py-6 text-text-muted">No scrape telemetry logs available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {}
        {activeTab === 'specs' && product.specs && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(product.specs).map(([key, value]) => (
              <div key={key} className="bg-surface-2 p-4 rounded-xl border border-border flex flex-col justify-center">
                <span className="text-xs text-text-muted font-semibold capitalize mb-1">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="text-sm font-bold text-text">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
