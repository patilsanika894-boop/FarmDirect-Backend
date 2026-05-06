const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    required: true
  },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  farmerName: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  // ✅ NEW: emoji icon for UI display
  emoji: {
    type: String,
    default: '🌿'
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String,
    default: ''
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  deliveryCharge: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // ✅ UPDATED: added 'upi' to payment methods
  paymentMethod: {
    type: String,
    enum: ['cod', 'online', 'wallet', 'upi'],
    required: true
  },

  // ✅ NEW: which UPI app was used (phonepe, gpay, paytm, etc.)
  upiApp: {
    type: String,
    enum: ['phonepe', 'gpay', 'paytm', 'amazonpay', 'bhim', 'other', null],
    default: null
  },

  // ✅ NEW: UPI transaction ID from payment
  upiTransactionId: {
    type: String,
    default: null
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: String,

  // ✅ NEW: timestamp when payment was completed
  paidAt: {
    type: Date,
    default: null
  },

  orderStatus: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'out-for-delivery',
      'delivered',
      'cancelled',
      'returned'
    ],
    default: 'pending'
  },

  deliveryAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    landmark: { type: String, default: '' },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },

  deliveryPartner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  estimatedDelivery: Date,
  actualDelivery: Date,
  trackingNumber: String,

  // ✅ NEW: full tracking history with timestamps
  trackingHistory: [{
    status: {
      type: String,
      enum: [
        'pending', 'confirmed', 'processing',
        'shipped', 'out-for-delivery', 'delivered',
        'cancelled', 'returned'
      ]
    },
    message: { type: String, default: '' },
    location: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  }],

  notes: { type: String, default: '' },
  cancellationReason: String,
  returnReason: String,

  // ✅ NEW: invoice data
  invoiceNumber: {
    type: String,
    default: null
  },
  invoiceGeneratedAt: {
    type: Date,
    default: null
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  gstPercent: {
    type: Number,
    default: 5   // 5% GST
  },
  invoiceAmount: {
    type: Number,
    default: 0   // finalAmount + gstAmount
  },

  itemsStatus: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    status: {
      type: String,
      enum: [
        'pending', 'confirmed', 'processing',
        'shipped', 'delivered', 'cancelled', 'returned'
      ]
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  notifications: [{
    type: {
      type: String,
      enum: [
        'order-placed', 'order-confirmed',
        'order-shipped', 'order-delivered', 'order-cancelled'
      ]
    },
    message: String,
    timestamp: { type: Date, default: Date.now },
    sentTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]

}, {
  timestamps: true
});


// ✅ Auto-generate orderNumber and invoiceNumber on new order
orderSchema.pre('save', async function () {
  if (this.isNew && !this.orderNumber) {
    this.orderNumber = `FD${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }

  // Auto-generate invoice number when payment is marked paid
  if (this.isModified('paymentStatus') && this.paymentStatus === 'paid') {
    if (!this.invoiceNumber) {
      this.invoiceNumber = `INV-${this.orderNumber}`;
      this.invoiceGeneratedAt = new Date();
    }
    if (!this.paidAt) {
      this.paidAt = new Date();
    }
  }

  // Auto-calculate GST and invoice amount
  if (this.isModified('finalAmount') || this.isNew) {
    this.gstAmount = parseFloat((this.finalAmount * (this.gstPercent / 100)).toFixed(2));
    this.invoiceAmount = parseFloat((this.finalAmount + this.gstAmount).toFixed(2));
  }

  // Auto-push to trackingHistory when orderStatus changes
  if (this.isModified('orderStatus')) {
    const messages = {
      pending:           'Order placed successfully',
      confirmed:         'Order confirmed by seller',
      processing:        'Order is being prepared',
      shipped:           'Order has been shipped',
      'out-for-delivery':'Order is out for delivery',
      delivered:         'Order delivered successfully',
      cancelled:         'Order has been cancelled',
      returned:          'Order has been returned'
    };
    this.trackingHistory.push({
      status: this.orderStatus,
      message: messages[this.orderStatus] || '',
      timestamp: new Date()
    });
  }
});


// ✅ Indexes
orderSchema.index({ customer: 1 });
orderSchema.index({ 'items.farmer': 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ invoiceNumber: 1 });  // ✅ NEW


// ✅ Static Methods (all original + new ones)
orderSchema.statics.findByCustomer = function(customerId) {
  return this.find({ customer: customerId }).sort({ createdAt: -1 });
};

orderSchema.statics.findByFarmer = function(farmerId) {
  return this.find({ 'items.farmer': farmerId }).sort({ createdAt: -1 });
};

orderSchema.statics.findByStatus = function(status) {
  return this.find({ orderStatus: status }).sort({ createdAt: -1 });
};

// ✅ NEW: find orders with unpaid UPI/online payment
orderSchema.statics.findUnpaid = function(customerId) {
  return this.find({
    customer: customerId,
    paymentStatus: 'pending',
    orderStatus: { $ne: 'cancelled' }
  }).sort({ createdAt: -1 });
};

// ✅ NEW: get invoice data for a single order
orderSchema.methods.getInvoiceData = function() {
  return {
    invoiceNumber:     this.invoiceNumber || `INV-${this.orderNumber}`,
    invoiceDate:       this.invoiceGeneratedAt || this.createdAt,
    orderNumber:       this.orderNumber,
    customerName:      this.customerName,
    customerEmail:     this.customerEmail,
    customerPhone:     this.customerPhone,
    deliveryAddress:   this.deliveryAddress,
    items:             this.items,
    subtotal:          this.totalAmount,
    discountAmount:    this.discountAmount,
    deliveryCharge:    this.deliveryCharge,
    finalAmount:       this.finalAmount,
    gstPercent:        this.gstPercent,
    gstAmount:         this.gstAmount,
    invoiceAmount:     this.invoiceAmount,
    paymentMethod:     this.paymentMethod,
    paymentStatus:     this.paymentStatus,
    paidAt:            this.paidAt
  };
};


module.exports = mongoose.model('Order', orderSchema);