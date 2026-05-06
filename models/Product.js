const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  discountPrice: {
    type: Number,
    min: [0, 'Discount price cannot be negative'],
    validate: {
      validator: function(value) {
        return !value || value < this.price;
      },
      message: 'Discount price must be less than regular price'
    }
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    enum: ['kg', 'litre', 'dozen', 'piece', 'gram', 'ml', 'packet', 'box']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['vegetables', 'fruits', 'grains', 'dairy', 'spices', 'flowers', 'seeds']
  },
  images: [{
    type: String,
    required: true
  }],
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  farmerName: {
    type: String,
    required: true
  },
  isOrganic: {
    type: Boolean,
    default: false
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  season: {
    type: String,
    enum: ['summer', 'winter', 'monsoon', 'year-round']
  },
  harvestDate: Date,
  expiryDate: Date,
  isAvailable: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  weight: {
    type: Number,
    min: 0
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  storageInstructions: String,
  nutritionalInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    fiber: Number,
    vitamins: [String],
    minerals: [String]
  },
  minimumOrderQuantity: {
    type: Number,
    default: 1,
    min: 1
  },
  maximumOrderQuantity: {
    type: Number,
    min: 1
  }
}, {
  timestamps: true
});

// Index for search functionality
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, isAvailable: 1 });
productSchema.index({ farmer: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'rating.average': -1 });

// Update rating average when new review is added
productSchema.methods.updateRating = function() {
  if (this.reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
  } else {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating.average = totalRating / this.reviews.length;
    this.rating.count = this.reviews.length;
  }
  return this.save();
};

// Get available products only
productSchema.statics.findAvailable = function() {
  return this.find({ isAvailable: true, quantity: { $gt: 0 } });
};

// Get products by category
productSchema.statics.findByCategory = function(category) {
  return this.find({ category, isAvailable: true, quantity: { $gt: 0 } });
};

// Get products by farmer
productSchema.statics.findByFarmer = function(farmerId) {
  return this.find({ farmer: farmerId });
};

module.exports = mongoose.model('Product', productSchema);
