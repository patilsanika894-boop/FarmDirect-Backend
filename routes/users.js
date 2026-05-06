const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  validateAddress,
  validateFarmerProfile
} = require('../middleware/validation');
const {
  getUsers,
  getUserById,
  updateProfile,
  updateFarmerProfile,
  approveFarmer,
  updateUserStatus,
  deleteUser,
  getFarmers,
  uploadAvatar
} = require('../controllers/userController');

// Public routes
router.get('/farmers', getFarmers);

// Protected routes
router.get('/profile', protect, getUserById);
router.put('/profile', protect, updateProfile);
router.post('/avatar', protect, uploadAvatar);

// Farmer routes
router.put('/farmer-profile', protect, authorize('farmer'), updateFarmerProfile);

// Admin routes
router.get('/', protect, authorize('admin'), getUsers);
router.get('/:id', protect, authorize('admin'), getUserById);
router.put('/:id/approve-farmer', protect, authorize('admin'), approveFarmer);
router.put('/:id/status', protect, authorize('admin'), updateUserStatus);
router.delete('/:id', protect, authorize('admin'), deleteUser);

module.exports = router;
