const Order = require('../models/Order');
const User = require('../models/User');

// @desc    Create COD order payment
// @route   POST /api/payments/cod
// @access  Private
const createCODOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (order.paymentMethod !== 'cod') {
      return res.status(400).json({
        success: false,
        message: 'Order payment method is not COD'
      });
    }

    // COD orders are confirmed immediately
    order.paymentStatus = 'pending'; // paid on delivery
    order.orderStatus = 'confirmed';
    order.trackingHistory.push({
      status: 'confirmed',
      message: 'COD order confirmed',
      timestamp: new Date()
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'COD order confirmed successfully',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        finalAmount: order.finalAmount
      }
    });
  } catch (error) {
    console.error('COD order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing COD order'
    });
  }
};

// @desc    Create Razorpay payment order
// @route   POST /api/payments/create-order
// @access  Private
const createPaymentOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if Razorpay keys are configured
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      // Fallback: return order details for manual payment handling
      return res.status(200).json({
        success: true,
        message: 'Payment gateway not configured. Use COD.',
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          finalAmount: order.finalAmount,
          paymentMethod: order.paymentMethod
        }
      });
    }

    // Razorpay integration
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.finalAmount * 100), // amount in paise
      currency: 'INR',
      receipt: order.orderNumber,
      notes: {
        orderId: order._id.toString(),
        customerName: req.user.name,
        customerEmail: req.user.email
      }
    });

    res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderId: order._id,
      orderNumber: order.orderNumber,
      key: process.env.RAZORPAY_KEY_ID,
      prefill: {
        name: req.user.name,
        email: req.user.email,
        contact: req.user.phone
      }
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating payment order'
    });
  }
};

// @desc    Verify Razorpay payment
// @route   POST /api/payments/verify
// @access  Private
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify signature if Razorpay keys are configured
    if (process.env.RAZORPAY_KEY_SECRET) {
      const crypto = require('crypto');
      const sign = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSign = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(sign)
        .digest('hex');

      if (razorpay_signature !== expectedSign) {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed - invalid signature'
        });
      }
    }

    // Update order payment status
    order.paymentStatus = 'paid';
    order.paidAt = new Date();
    order.orderStatus = 'confirmed';
    order.upiTransactionId = razorpay_payment_id;
    order.trackingHistory.push({
      status: 'confirmed',
      message: 'Payment verified and order confirmed',
      timestamp: new Date()
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        paidAt: order.paidAt
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying payment'
    });
  }
};

// @desc    Get payment history for current user
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      customer: req.user._id,
      paymentStatus: { $in: ['paid', 'refunded'] }
    };

    // Admin can see all payments
    if (req.user.role === 'admin') {
      delete filter.customer;
    }

    const orders = await Order.find(filter)
      .select('orderNumber finalAmount paymentMethod paymentStatus paidAt createdAt items')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    // Calculate totals
    const totalPaid = await Order.aggregate([
      { $match: { ...filter, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    res.status(200).json({
      success: true,
      payments: orders,
      totalPaid: totalPaid[0]?.total || 0,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching payment history'
    });
  }
};

// @desc    Refund payment (Admin only)
// @route   POST /api/payments/refund
// @access  Private/Admin
const refundPayment = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order has not been paid yet'
      });
    }

    // Mark as refunded
    order.paymentStatus = 'refunded';
    order.orderStatus = 'cancelled';
    order.cancellationReason = reason || 'Refund requested by admin';
    order.trackingHistory.push({
      status: 'cancelled',
      message: `Refund processed: ${reason || 'Admin initiated refund'}`,
      timestamp: new Date()
    });

    await order.save();

    // Restore product quantities
    for (const item of order.items) {
      await require('../models/Product').findByIdAndUpdate(
        item.product,
        { $inc: { quantity: item.quantity } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        finalAmount: order.finalAmount
      }
    });
  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing refund'
    });
  }
};

module.exports = {
  createCODOrder,
  createPaymentOrder,
  verifyPayment,
  getPaymentHistory,
  refundPayment
};