const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary
} = require('../controllers/cartController');

// Protected routes
router.get('/', protect, getCart);
router.get('/summary', protect, getCartSummary);
router.post('/add', protect, addToCart);
router.put('/update', protect, updateCartItem);
router.delete('/remove/:productId', protect, removeFromCart);
router.delete('/clear', protect, clearCart);

module.exports = router;
