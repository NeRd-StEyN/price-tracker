import { Router } from 'express';
import { runAllScrapes, isScraping } from '../scraper/runAll.js';

const router = Router();

// Protect this route with a secret header to prevent unauthorized abuse
const requireCronSecret = (req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
  }
  next();
};

// Apply security middleware
router.use(requireCronSecret);

// Handler for both GET and POST
const handleScrapeRequest = (req, res) => {
  // 1. In-memory lock check
  if (isScraping) {
    // 202 Accepted, but return immediately indicating it's already running
    return res.status(202).json({
      started: false,
      reason: 'already running'
    });
  }

  // 2. Start the scraper in the background (DO NOT await it here)
  runAllScrapes().catch(err => {
    console.error('Background scrape failed to execute:', err);
  });

  // 3. Immediately return 202 Accepted so cron-job.org does not timeout
  return res.status(202).json({
    started: true
  });
};

router.post('/', handleScrapeRequest);
router.get('/', handleScrapeRequest);

export default router;
