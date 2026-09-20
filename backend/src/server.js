import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health.js';
import searchRouter from './routes/search.js';
import productsRouter from './routes/products.js';
import scrapeRouter from './routes/scrape.js';
import { syncCatalog } from './scraper/syncCatalog.js';
import { runScheduledScrapes } from './scheduler.js';
import { supabase } from './db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS using FRONTEND_URL if provided, else allow all (for dev)
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// JSON parsing middleware
app.use(express.json());

// Routes
app.use('/health', healthRouter);
app.use('/api/search', searchRouter);
app.use('/api', productsRouter); // Handles /api/track and /api/products...
app.use('/api/scrape', scrapeRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    status: statusCode
  });
});

app.listen(port, async () => {
  console.log(`Backend server listening on port ${port}`);
  
  // Check if we already have catalog items
  const { count, error } = await supabase
    .from('catalog')
    .select('*', { count: 'exact', head: true });
    
  if (!error && count === 0) {
    console.log('Catalog is empty. Running initial sync...');
    syncCatalog();
  } else {
    console.log(`Catalog already has ${count} items. Skipping initial startup sync to prevent rate-limits.`);
  }
  
  // Schedule catalog sync every 24 hours
  setInterval(syncCatalog, 24 * 60 * 60 * 1000);

  // Background Scrape Scheduler: Checks every 5 minutes for products due for background rescrape
  setTimeout(() => runScheduledScrapes(), 10000);
  setInterval(runScheduledScrapes, 5 * 60 * 1000);
});
