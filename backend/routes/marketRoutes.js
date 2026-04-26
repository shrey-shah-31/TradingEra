import { Router } from 'express';
import {
  prices,
  history,
  search,
  movers,
  indianStocks,
  allIndianStocks,
  indianStocksList,
  stockBySymbol,
} from '../controllers/marketController.js';

const router = Router();

router.get('/prices', prices);
router.get('/history', history);
router.get('/search', search);
router.get('/movers', movers);
router.get('/indian-stocks/all', allIndianStocks);
router.get('/indian-stocks/list', indianStocksList);
router.get('/indian-stocks', indianStocks);
router.get('/stock/:symbol', stockBySymbol);

export default router;
