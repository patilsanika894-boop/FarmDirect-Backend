const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validation');

const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  getCustomerOrders,
  getFarmerOrders,
  cancelOrder,
  updatePayment,    // ✅ NEW
  getInvoice,       // ✅ NEW
  getOrderTracking  // ✅ NEW
} = require('../controllers/orderController');

// ── Existing routes (unchanged) ──────────────────────────────
router.get('/', protect, authorize('admin'), getOrders);
router.get('/my-orders', protect, getCustomerOrders);
router.get('/farmer-orders', protect, authorize('farmer'), getFarmerOrders);
router.get('/:id', protect, getOrderById);
router.post('/', protect, validateOrder, createOrder);
router.put('/:id/status', protect, authorize('admin', 'farmer', 'delivery'), updateOrderStatus);
router.put('/:id/cancel', protect, cancelOrder);

// ── New routes ────────────────────────────────────────────────
// PUT /api/orders/:id/payment  → pay via COD or UPI
router.put('/:id/payment', protect, updatePayment);

// GET /api/orders/:id/invoice  → get invoice data
router.get('/:id/invoice', protect, getInvoice);

// GET /api/orders/:id/tracking → get tracking timeline
router.get('/:id/tracking', protect, getOrderTracking);

module.exports = router;
