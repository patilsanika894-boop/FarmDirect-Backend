const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500,
    trim: true
  },
  images: [String],
  isVerified: {
    type: Boolean,
    default: false
  },
  helpful: {
    type: Number,
    default: 0
  },
  helpfulUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Ensure one review per product per customer per order
reviewSchema.index({ product: 1, customer: 1, order: 1 }, { unique: true });
reviewSchema.index({ product: 1 });
reviewSchema.index({ farmer: 1 });
reviewSchema.index({ customer: 1 });
reviewSchema.index({ rating: 1 });

// Check if user can review
reviewSchema.statics.canReview = async function(productId, customerId, orderId) {
  const existingReview = await this.findOne({ product: productId, customer: customerId, order: orderId });
  return !existingReview;
};

// Get reviews by product
reviewSchema.statics.findByProduct = function(productId, page = 1, limit = 10) {
  return this.find({ product: productId })
    .populate('customer', 'name avatar')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Get reviews by farmer
reviewSchema.statics.findByFarmer = function(farmerId) {
  return this.find({ farmer: farmerId })
    .populate('customer', 'name avatar')
    .populate('product', 'name')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Review', reviewSchema);
