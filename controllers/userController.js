const User = require('../models/User');
const { cloudinary } = require('../middleware/upload');

// @desc    Get all users (Admin)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { role, search, isActive } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password -resetPasswordToken -emailVerificationToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users'
    });
  }
};

// @desc    Get user by ID or current user profile
// @route   GET /api/users/profile  or  GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    // If :id param exists use it, otherwise use logged in user
    const userId = req.params.id || req.user._id;

    const user = await User.findById(userId)
      .select('-password -resetPasswordToken -emailVerificationToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user'
    });
  }
};

// @desc    Update current user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields only
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
};

// @desc    Update farmer profile details
// @route   PUT /api/users/farmer-profile
// @access  Private/Farmer
const updateFarmerProfile = async (req, res) => {
  try {
    const { farmDetails } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'farmer') {
      return res.status(403).json({
        success: false,
        message: 'Only farmers can update farm profile'
      });
    }

    // Merge existing farmDetails with new ones
    user.farmDetails = {
      ...user.farmDetails.toObject(),
      ...farmDetails
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Farm profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update farmer profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating farmer profile'
    });
  }
};

// @desc    Approve farmer account (Admin)
// @route   PUT /api/users/:id/approve-farmer
// @access  Private/Admin
const approveFarmer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'farmer') {
      return res.status(400).json({
        success: false,
        message: 'User is not a farmer'
      });
    }

    user.isApproved = true;
    user.isVerified = true;
    await user.save();

    // Send approval email (non-critical)
    try {
      const emailService = require('../utils/emailService');
      await emailService.sendFarmerApprovalEmail(user);
    } catch (emailError) {
      console.log('Approval email failed (non-critical):', emailError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Farmer approved successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Approve farmer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error approving farmer'
    });
  }
};

// @desc    Activate or deactivate user (Admin)
// @route   PUT /api/users/:id/status
// @access  Private/Admin
const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change admin status'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating user status'
    });
  }
};

// @desc    Delete user (Admin)
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin account'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting user'
    });
  }
};

// @desc    Get all approved farmers (Public)
// @route   GET /api/users/farmers
// @access  Public
const getFarmers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search, farmingType } = req.query;

    const filter = {
      role: 'farmer',
      isApproved: true,
      isActive: true
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'farmDetails.farmName': { $regex: search, $options: 'i' } },
        { 'farmDetails.farmAddress.city': { $regex: search, $options: 'i' } }
      ];
    }

    if (farmingType) {
      filter['farmDetails.farmingType'] = farmingType;
    }

    const farmers = await User.find(filter)
      .select('name avatar farmDetails address createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      farmers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get farmers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching farmers'
    });
  }
};

// @desc    Upload user avatar
// @route   POST /api/users/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old avatar from Cloudinary if exists
    if (user.avatar && user.avatar.includes('cloudinary')) {
      try {
        const publicId = user.avatar.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`farmdirect/avatars/${publicId}`);
      } catch (deleteError) {
        console.log('Old avatar delete failed (non-critical):', deleteError.message);
      }
    }

    // Save new avatar URL
    user.avatar = req.file.path;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: user.avatar
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading avatar'
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateProfile,
  updateFarmerProfile,
  approveFarmer,
  updateUserStatus,
  deleteUser,
  getFarmers,
  uploadAvatar
};