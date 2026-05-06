const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/setup/admin
// Run ONCE to create admin — locks itself after that
router.post('/admin', async (req, res) => {
  try {

    // Block if admin already exists
    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      return res.status(403).json({
        success: false,
        message: '🔒 Admin already exists. This setup route is now locked.'
      });
    }

    // Verify secret key
    const { secretKey } = req.body;
    if (!secretKey || secretKey !== process.env.ADMIN_SETUP_SECRET) {
      return res.status(401).json({
        success: false,
        message: '❌ Invalid or missing secret key.'
      });
    }

    // Create admin
    // Password is plain here — your User model pre-save hook hashes it automatically
    const admin = await User.create({
      name: 'FarmDirect Admin',
      email: 'admin@farmdirect.com',
      password: 'Admin@123',
      phone: '9999999999',
      role: 'admin',
      isVerified: true,
      isApproved: true,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: '✅ Admin created successfully!',
      credentials: {
        email: 'admin@farmdirect.com',
        password: 'Admin@123',
        warning: '⚠️  Change this password after first login!'
      }
    });

  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during admin setup.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;