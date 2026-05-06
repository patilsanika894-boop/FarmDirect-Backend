const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

// ✅ GET DASHBOARD - /api/admin/dashboard
const getDashboard = async (req, res) => {
  try {
    const [
      totalCustomers,
      totalFarmers,
      totalDelivery,
      totalProducts,
      totalOrders,
      pendingFarmers,
      recentOrders
    ] = await Promise.all([
      User.countDocuments({ role: 'customer', isActive: true }),
      User.countDocuments({ role: 'farmer', isActive: true }),
      User.countDocuments({ role: 'delivery', isActive: true }),
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments({ role: 'farmer', isApproved: false }),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customer', 'name email phone')
        .populate('items.product', 'name price')
    ]);

    const revenueData = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalCustomers,
          totalFarmers,
          totalDelivery,
          totalProducts,
          totalOrders,
          pendingFarmers,
          totalRevenue
        },
        recentOrders
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ GET ALL USERS - /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 100, search } = req.query;

    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -resetPasswordToken -emailVerificationToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      total,
      users
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ BLOCK / UNBLOCK USER - /api/admin/users/:userId/block
const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { block } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot block an admin account' });
    }

    // Support both isBlocked and isActive fields
    user.isBlocked = block;
    user.isActive = !block;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${block ? 'blocked' : 'unblocked'} successfully`
    });

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ GET USERS STATS - /api/admin/stats/users
const getUsersStats = async (req, res) => {
  try {
    const { role, page = 1, limit = 10, search } = req.query;

    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total, customerCount, farmerCount, deliveryCount] = await Promise.all([
      User.find(query)
        .select('-password -resetPasswordToken -emailVerificationToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'farmer' }),
      User.countDocuments({ role: 'delivery' })
    ]);

    res.status(200).json({
      success: true,
      stats: { total, customerCount, farmerCount, deliveryCount },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      users
    });

  } catch (error) {
    console.error('Users stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ GET ORDERS STATS - /api/admin/stats/orders
const getOrdersStats = async (req, res) => {
  try {
    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      recentOrders
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'delivered' }),
      Order.countDocuments({ status: 'cancelled' }),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('customer', 'name email')
        .populate('items.product', 'name price')
    ]);

    res.status(200).json({
      success: true,
      stats: { totalOrders, pendingOrders, deliveredOrders, cancelledOrders },
      recentOrders
    });

  } catch (error) {
    console.error('Orders stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ GET PRODUCTS STATS - /api/admin/stats/products
const getProductsStats = async (req, res) => {
  try {
    const [
      totalProducts,
      activeProducts,
      outOfStockProducts,
      productsByCategory
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ quantity: 0 }),
      Product.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    const recentProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('farmer', 'name farmDetails.farmName');

    res.status(200).json({
      success: true,
      stats: { totalProducts, activeProducts, outOfStockProducts, productsByCategory },
      recentProducts
    });

  } catch (error) {
    console.error('Products stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ GET REVENUE STATS - /api/admin/stats/revenue
const getRevenueStats = async (req, res) => {
  try {
    const totalRevenueData = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const topProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalRevenue: totalRevenueData[0]?.total || 0,
        monthlyRevenue,
        topProducts
      }
    });

  } catch (error) {
    console.error('Revenue stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ APPROVE FARMER - /api/admin/users/:id/approve
const approveFarmer = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'farmer') {
      return res.status(400).json({ success: false, message: 'User is not a farmer' });
    }

    user.isApproved = true;
    user.isVerified = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Farmer approved successfully',
      user: user.getPublicProfile()
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ TOGGLE USER STATUS - /api/admin/users/:id/toggle
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate admin' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ DELETE USER - /api/admin/users/:userId
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId || req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete admin account' });
    }

    await User.findByIdAndDelete(req.params.userId || req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboard,
  getAllUsers,
  blockUser,
  getUsersStats,
  getOrdersStats,
  getProductsStats,
  getRevenueStats,
  approveFarmer,
  toggleUserStatus,
  deleteUser
};