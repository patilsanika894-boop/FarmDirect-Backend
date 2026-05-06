const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },

  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
  },

  role: {
    type: String,
    enum: ['customer', 'farmer', 'admin', 'delivery'],
    default: 'customer'
  },

  avatar: {
    type: String,
    default: ''
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  isApproved: {
    type: Boolean,
    default: true
  },

  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },

  // Farmer specific fields
  farmDetails: {
    farmName: String,
    farmAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    farmSize: Number,
    farmingType: {
      type: String,
      enum: ['organic', 'conventional', 'mixed']
    },
    certifications: [String],
    description: String
  },

  // Delivery partner specific fields
  deliveryDetails: {
    vehicleType: {
      type: String,
      enum: ['bike', 'car', 'van']
    },
    vehicleNumber: String,
    licenseNumber: String,
    isAvailable: {
      type: Boolean,
      default: true
    }
  },

  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerificationToken: String,
  lastLogin: Date,

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});


// ✅ Correct Password Hash Middleware
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});


// ✅ Compare Password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};


// ✅ Get Public Profile
userSchema.methods.getPublicProfile = function () {
  const user = this.toObject();

  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpire;
  delete user.emailVerificationToken;

  return user;
};


module.exports = mongoose.model('User', userSchema);