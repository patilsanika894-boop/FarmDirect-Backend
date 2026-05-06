const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: [
      'order-placed',
      'order-confirmed',
      'order-shipped',
      'order-delivered',
      'order-cancelled',
      'payment-received',
      'product-approved',
      'product-rejected',
      'farmer-approved',
      'farmer-rejected',
      'review-received',
      'complaint-received',
      'delivery-assigned',
      'system-update'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    orderId: mongoose.Schema.Types.ObjectId,
    productId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    amount: Number,
    status: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  channels: [{
    type: String,
    enum: ['in-app', 'email', 'sms', 'push']
  }],
  sentVia: [{
    channel: {
      type: String,
      enum: ['in-app', 'email', 'sms', 'push']
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending'
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

// Get unread notifications for user
notificationSchema.statics.findUnread = function(userId) {
  return this.find({ recipient: userId, isRead: false })
    .sort({ createdAt: -1 });
};

// Get notifications by user with pagination
notificationSchema.statics.findByUser = function(userId, page = 1, limit = 20) {
  return this.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('sender', 'name avatar');
};

// Mark notification as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Mark multiple notifications as read
notificationSchema.statics.markMultipleAsRead = function(notificationIds) {
  return this.updateMany(
    { _id: { $in: notificationIds } },
    { isRead: true }
  );
};

// Get unread count for user
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

module.exports = mongoose.model('Notification', notificationSchema);
