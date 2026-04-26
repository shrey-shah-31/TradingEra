import { Router } from 'express';
import {
  getWatchlist,
  addWatchlist,
  removeWatchlist,
  setTheme,
  listAlerts,
  addAlert,
  removeAlert,
} from '../controllers/userController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { watchlistSchema, alertSchema, themeSchema } from '../validations/schemas.js';

const router = Router();
router.use(protect);

router.get('/watchlist', getWatchlist);
router.post('/watchlist', validate(watchlistSchema), addWatchlist);
router.delete('/watchlist/:symbol', removeWatchlist);

router.patch('/theme', validate(themeSchema), setTheme);

router.get('/alerts', listAlerts);
router.post('/alerts', validate(alertSchema), addAlert);
router.delete('/alerts/:id', removeAlert);

export default router;
