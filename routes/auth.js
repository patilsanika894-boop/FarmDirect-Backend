const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  validateUserRegistration,
  validateUserLogin
} = require('../middleware/validation');
const {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getMe,
  updatePassword,
  logout
} = require('../controllers/authController');

// Public routes
router.post('/register', validateUserRegistration, register);
router.post('/login', validateUserLogin, login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);
router.post('/logout', protect, logout);

module.exports = router;
