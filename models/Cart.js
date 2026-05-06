const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  totalItems: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Helper to safely get product ID string
const getProductId = (product) => {
  if (!product) return null;
  if (product._id) return product._id.toString();
  return product.toString();
};

// Calculate total amount and items
cartSchema.methods.calculateTotals = function() {
  // Filter out null/deleted products first
  this.items = this.items.filter(item => item.product !== null && item.product !== undefined);
  this.totalAmount = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  return this.save();
};

// Add item to cart
cartSchema.methods.addItem = function(product, quantity) {
  // Filter out null/deleted products first
  this.items = this.items.filter(item => item.product !== null && item.product !== undefined);

  const existingItem = this.items.find(item => {
    try {
      const id = getProductId(item.product);
      return id === product._id.toString();
    } catch(e) {
      return false;
    }
  });

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({
      product: product._id,
      quantity,
      price: product.discountPrice || product.price,
      farmer: product.farmer
    });
  }

  return this.calculateTotals();
};

// Update item quantity
cartSchema.methods.updateItem = function(productId, quantity) {
  // Filter out null/deleted products first
  this.items = this.items.filter(item => item.product !== null && item.product !== undefined);

  const item = this.items.find(item => {
    try {
      return getProductId(item.product) === productId.toString();
    } catch(e) {
      return false;
    }
  });

  if (item) {
    if (quantity <= 0) {
      this.items = this.items.filter(item => {
        try {
          return getProductId(item.product) !== productId.toString();
        } catch(e) {
          return true;
        }
      });
    } else {
      item.quantity = quantity;
    }
  }

  return this.calculateTotals();
};

// Remove item from cart
cartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(item => {
    if (!item.product) return false;
    try {
      return getProductId(item.product) !== productId.toString();
    } catch(e) {
      return false;
    }
  });
  return this.calculateTotals();
};

// Clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.totalAmount = 0;
  this.totalItems = 0;
  return this.save();
};

// Get cart by customer
cartSchema.statics.findByCustomer = function(customerId) {
  return this.findOne({ customer: customerId }).populate({
    path: 'items.product',
    match: { _id: { $exists: true } }
  });
};

module.exports = mongoose.model('Cart', cartSchema);