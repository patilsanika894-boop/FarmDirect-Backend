const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const {
  getDashboard,
  getUsersStats,
  getOrdersStats,
  getProductsStats,
  getRevenueStats,
  getAllUsers,
  blockUser,
  deleteUser,
} = require('../controllers/adminController');

// Dashboard & stats
router.get('/dashboard',        protect, authorize('admin'), getDashboard);
router.get('/stats/users',      protect, authorize('admin'), getUsersStats);
router.get('/stats/orders',     protect, authorize('admin'), getOrdersStats);
router.get('/stats/products',   protect, authorize('admin'), getProductsStats);
router.get('/stats/revenue',    protect, authorize('admin'), getRevenueStats);

// Users management
router.get('/users',                    protect, authorize('admin'), getAllUsers);
router.put('/users/:userId/block',      protect, authorize('admin'), blockUser);
router.delete('/users/:userId',         protect, authorize('admin'), deleteUser);

module.exports = router;
