const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Controllers
const {
  createPaymentOrder,
  verifyPayment,
  getPaymentHistory,
  refundPayment,
  createCODOrder
} = require('../controllers/paymentController');

// Protected routes
router.post('/cod', protect, createCODOrder);
router.post('/create-order', protect, createPaymentOrder);
router.post('/verify', protect, verifyPayment);
router.get('/history', protect, getPaymentHistory);
router.post('/refund', protect, authorize('admin'), refundPayment);

module.exports = router;
