const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  complaintNumber: {
    type: String,
    required: true,
    unique: true
  },
  complainant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  complainantName: {
    type: String,
    required: true
  },
  complainantEmail: {
    type: String,
    required: true
  },
  complainantPhone: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'product-quality',
      'delivery-issue',
      'payment-issue',
      'farmer-behavior',
      'customer-behavior',
      'platform-issue',
      'account-issue',
      'other'
    ],
    required: true
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'under-review', 'investigating', 'resolved', 'closed', 'rejected'],
    default: 'pending'
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  relatedProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  responses: [{
    responder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    responderName: {
      type: String,
      required: true
    },
    responderRole: {
      type: String,
      enum: ['admin', 'support', 'system'],
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    attachments: [{
      filename: String,
      url: String
    }],
    isInternal: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  resolution: {
    description: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    customerSatisfaction: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String
  },
  escalationLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: 3
  },
  dueDate: Date,
  tags: [String]
}, {
  timestamps: true
});

// Generate unique complaint number
complaintSchema.pre('save', async function(next) {
  if (!this.complaintNumber) {
    const count = await this.constructor.countDocuments();
    this.complaintNumber = `CMP${Date.now()}${String(count).padStart(4, '0')}`;
  }
  next();
});

// Set due date based on priority
complaintSchema.pre('save', function(next) {
  if (!this.dueDate && this.isNew) {
    const now = new Date();
    switch (this.priority) {
      case 'urgent':
        this.dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day
        break;
      case 'high':
        this.dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
        break;
      case 'medium':
        this.dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
        break;
      case 'low':
        this.dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks
        break;
    }
  }
  next();
});

// Index for efficient queries
complaintSchema.index({ complainant: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ type: 1 });
complaintSchema.index({ priority: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ assignedTo: 1 });
complaintSchema.index({ dueDate: 1 });

// Get complaints by user
complaintSchema.statics.findByUser = function(userId) {
  return this.find({ complainant: userId }).sort({ createdAt: -1 });
};

// Get complaints by status
complaintSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Get overdue complaints
complaintSchema.statics.findOverdue = function() {
  return this.find({
    status: { $in: ['pending', 'under-review', 'investigating'] },
    dueDate: { $lt: new Date() }
  }).sort({ dueDate: 1 });
};

// Add response to complaint
complaintSchema.methods.addResponse = function(responderId, responderName, responderRole, message, attachments = [], isInternal = false) {
  this.responses.push({
    responder: responderId,
    responderName,
    responderRole,
    message,
    attachments,
    isInternal,
    createdAt: new Date()
  });
  
  // Update status if needed
  if (this.status === 'pending' && responderRole !== 'system') {
    this.status = 'under-review';
  }
  
  return this.save();
};

// Resolve complaint
complaintSchema.methods.resolve = function(resolvedById, description) {
  this.status = 'resolved';
  this.resolution = {
    description,
    resolvedBy: resolvedById,
    resolvedAt: new Date()
  };
  return this.save();
};

module.exports = mongoose.model('Complaint', complaintSchema);
