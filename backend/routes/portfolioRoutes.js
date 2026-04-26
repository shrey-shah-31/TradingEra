import { Router } from 'express';
import { getPortfolio, getHistory, getRealizedPnl } from '../controllers/portfolioController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();
router.use(protect);
router.get('/', getPortfolio);
router.get('/history', getHistory);
router.get('/pnl', getRealizedPnl);

export default router;
