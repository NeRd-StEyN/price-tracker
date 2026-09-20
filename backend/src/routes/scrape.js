import { Router } from 'express';
import { runAllScrapes, isScraping } from '../scraper/runAll.js';

const router = Router();

const requireCronSecret = (req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
  }
  next();
};

router.use(requireCronSecret);

const handleScrapeRequest = (req, res) => {
  
  if (isScraping) {
    
    return res.status(202).json({
      started: false,
      reason: 'already running'
    });
  }

  runAllScrapes().catch(err => {
    console.error('Background scrape failed to execute:', err);
  });

  return res.status(202).json({
    started: true
  });
};

router.post('/', handleScrapeRequest);
router.get('/', handleScrapeRequest);

export default router;
