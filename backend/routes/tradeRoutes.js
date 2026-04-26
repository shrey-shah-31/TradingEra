import { Router } from 'express';
import { buy, sell, listOrders, cancelOrder, patchOrder } from '../controllers/tradeController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { tradeSchema, updateOrderSchema } from '../validations/schemas.js';

const router = Router();

router.use(protect);

router.post('/buy', validate(tradeSchema), buy);
router.post('/sell', validate(tradeSchema), sell);
router.get('/orders', listOrders);
router.delete('/order/:id', cancelOrder);
router.patch('/order/:id', validate(updateOrderSchema), patchOrder);

export default router;
