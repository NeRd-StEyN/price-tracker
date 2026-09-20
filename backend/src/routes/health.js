import { Router } from 'express';

const router = Router();

// GET /health -> { ok: true }
// Used to keep the server warm
router.get('/', (req, res) => {
  res.json({ ok: true });
});

export default router;
