const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const emailService = require('../utils/emailService');

// @desc    Get all orders (Admin only)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { status, paymentStatus, startDate, endDate } = req.query;

    const filter = {};
    if (status) filter.orderStatus = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await Order.find(filter)
      .populate('customer', 'name email phone')
      .populate('items.farmer', 'name')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching orders'
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone address')
      .populate('items.farmer', 'name farmDetails.farmName')
      .populate('items.product', 'name images');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const isOwner = order.customer._id.toString() === req.user._id.toString();
    const isFarmer = order.items.some(item =>
      item.farmer._id.toString() === req.user._id.toString()
    );
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isFarmer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching order'
    });
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { items, deliveryAddress, paymentMethod, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    const cart = await Cart.findByCustomer(req.user._id);
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    let totalAmount = 0;
    let orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`
        });
      }

      if (!product.isAvailable || product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is not available or insufficient quantity`
        });
      }

      product.quantity -= item.quantity;
      await product.save();

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        unit: product.unit,
        farmer: product.farmer,
        farmerName: product.farmerName,
        image: product.images?.[0] || '',
        emoji: product.emoji || '🌿'
      });
    }

    let deliveryCharge = 0;
    if (totalAmount < 500) {
      deliveryCharge = 40;
    }

    const finalAmount = totalAmount + deliveryCharge;

    // If COD, mark payment as pending; if UPI/online it stays pending until confirmed
    const order = await Order.create({
      customer: req.user._id,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone: req.user.phone,
      items: orderItems,
      totalAmount,
      deliveryCharge,
      finalAmount,
      paymentMethod,
      paymentStatus: 'pending',
      deliveryAddress,
      notes,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      itemsStatus: orderItems.map(item => ({
        product: item.product,
        status: 'pending',
        farmer: item.farmer
      }))
    });

    await cart.clearCart();

    await emailService.sendOrderConfirmationEmail(req.user, order);

    const populatedOrder = await Order.findById(order._id)
      .populate('customer', 'name email')
      .populate('items.farmer', 'name')
      .populate('items.product', 'name');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: populatedOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin/Farmer/Delivery
const updateOrderStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const isFarmer = order.items.some(item =>
      item.farmer.toString() === req.user._id.toString()
    );
    const isAdmin = req.user.role === 'admin';
    const isDelivery = req.user.role === 'delivery';

    if (!isAdmin && !isFarmer && !isDelivery) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['out-for-delivery'],
      'out-for-delivery': ['delivered'],
      'delivered': [],
      'cancelled': [],
      'returned': []
    };

    if (!validTransitions[order.orderStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${order.orderStatus} to ${status}`
      });
    }

    order.orderStatus = status;

    if (status === 'cancelled' && reason) {
      order.cancellationReason = reason;
    }

    if (status === 'delivered') {
      order.actualDelivery = new Date();
    }

    await order.save();

    const customer = await User.findById(order.customer);
    await emailService.sendOrderStatusEmail(customer, order, status);

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating order status'
    });
  }
};

// @desc    Get customer's orders
// @route   GET /api/orders/my-orders
// @access  Private
const getCustomerOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { status } = req.query;

    const filter = { customer: req.user._id };
    if (status && status !== 'all') filter.orderStatus = status;

    const orders = await Order.find(filter)
      .populate('items.product', 'name images')
      .populate('items.farmer', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching customer orders'
    });
  }
};

// @desc    Get farmer's orders
// @route   GET /api/orders/farmer-orders
// @access  Private/Farmer
const getFarmerOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { status } = req.query;

    const orders = await Order.findByFarmer(req.user._id)
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    let filteredOrders = orders;
    if (status) {
      filteredOrders = orders.filter(order =>
        order.items.some(item =>
          item.farmer.toString() === req.user._id.toString() &&
          order.itemsStatus.find(statusItem =>
            statusItem.product.toString() === item.product.toString() &&
            statusItem.status === status
          )
        )
      );
    }

    const total = await Order.countDocuments({ 'items.farmer': req.user._id });

    res.status(200).json({
      success: true,
      orders: filteredOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get farmer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching farmer orders'
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const isOwner = order.customer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!['pending', 'confirmed'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    order.orderStatus = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by customer';
    await order.save();

    // Restore product quantities
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity }
      });
    }

    // If already paid, mark for refund
    if (order.paymentStatus === 'paid') {
      order.paymentStatus = 'refunded';
      await order.save();
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling order'
    });
  }
};

// ─────────────────────────────────────────────
// ✅ NEW: Update payment (COD confirm / UPI pay)
// @desc    Update payment method and mark as paid
// @route   PUT /api/orders/:id/payment
// @access  Private
// ─────────────────────────────────────────────
const updatePayment = async (req, res) => {
  try {
    const { paymentMethod, upiApp, upiTransactionId } = req.body;
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Only the order owner can pay
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Cannot pay for cancelled orders
    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot process payment for a cancelled order'
      });
    }

    // Already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid'
      });
    }

    // Update payment fields
    order.paymentMethod = paymentMethod; // 'cod' or 'upi'
    order.paymentStatus = 'paid';
    order.paidAt = new Date();

    if (paymentMethod === 'upi') {
      order.upiApp = upiApp || 'other';
      order.upiTransactionId = upiTransactionId || `TXN${Date.now()}`;
    }

    // Auto-generate invoice number (handled in pre-save hook in Order.js)
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        upiApp: order.upiApp,
        upiTransactionId: order.upiTransactionId,
        paidAt: order.paidAt,
        invoiceNumber: order.invoiceNumber,
        invoiceAmount: order.invoiceAmount
      }
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating payment'
    });
  }
};

// ─────────────────────────────────────────────
// ✅ NEW: Get invoice data
// @desc    Get invoice details for an order
// @route   GET /api/orders/:id/invoice
// @access  Private
// ─────────────────────────────────────────────
const getInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('items.product', 'name images');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Only owner or admin can view invoice
    const isOwner = order.customer._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Use the instance method from Order model
    const invoiceData = order.getInvoiceData();

    res.status(200).json({
      success: true,
      invoiceData
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching invoice'
    });
  }
};

// ─────────────────────────────────────────────
// ✅ NEW: Get order tracking history
// @desc    Get full tracking timeline for an order
// @route   GET /api/orders/:id/tracking
// @access  Private
// ─────────────────────────────────────────────
const getOrderTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('orderNumber orderStatus trackingHistory trackingNumber estimatedDelivery actualDelivery customer');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const isOwner = order.customer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      tracking: {
        orderNumber: order.orderNumber,
        currentStatus: order.orderStatus,
        trackingNumber: order.trackingNumber,
        estimatedDelivery: order.estimatedDelivery,
        actualDelivery: order.actualDelivery,
        history: order.trackingHistory
      }
    });
  } catch (error) {
    console.error('Get tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching tracking info'
    });
  }
};

module.exports = {
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
};