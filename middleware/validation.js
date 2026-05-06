const { body, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User registration validation
const validateUserRegistration = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  
  body('role')
    .optional()
    .isIn(['customer', 'farmer', 'delivery'])
    .withMessage('Invalid role specified'),
  
  handleValidationErrors
];

// User login validation
const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Product validation
const validateProduct = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Product name must be between 2 and 100 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Product description is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('discountPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount price must be a positive number'),
  
  body('quantity')
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  
  body('unit')
    .isIn(['kg', 'litre', 'dozen', 'piece', 'gram', 'ml', 'packet', 'box'])
    .withMessage('Invalid unit specified'),
  
  body('category')
    .isIn(['vegetables', 'fruits', 'grains', 'dairy', 'spices', 'flowers', 'seeds'])
    .withMessage('Invalid category specified'),
  
  body('isOrganic')
    .optional()
    .isBoolean()
    .withMessage('isOrganic must be a boolean'),
  
  handleValidationErrors
];

// Order validation
const validateOrder = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  
  body('items.*.product')
    .isMongoId()
    .withMessage('Invalid product ID'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  
  body('deliveryAddress.street')
    .notEmpty()
    .withMessage('Street address is required'),
  
  body('deliveryAddress.city')
    .notEmpty()
    .withMessage('City is required'),
  
  body('deliveryAddress.state')
    .notEmpty()
    .withMessage('State is required'),
  
  body('deliveryAddress.pincode')
    .matches(/^\d{6}$/)
    .withMessage('Please provide a valid 6-digit pincode'),
  
  body('paymentMethod')
    .isIn(['cod', 'online', 'wallet'])
    .withMessage('Invalid payment method'),
  
  handleValidationErrors
];

// Review validation
const validateReview = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment cannot exceed 500 characters'),
  
  body('product')
    .isMongoId()
    .withMessage('Invalid product ID'),
  
  body('order')
    .isMongoId()
    .withMessage('Invalid order ID'),
  
  handleValidationErrors
];

// Complaint validation
const validateComplaint = [
  body('type')
    .isIn([
      'product-quality',
      'delivery-issue',
      'payment-issue',
      'farmer-behavior',
      'customer-behavior',
      'platform-issue',
      'account-issue',
      'other'
    ])
    .withMessage('Invalid complaint type'),
  
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 20, max: 2000 })
    .withMessage('Description must be between 20 and 2000 characters'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),
  
  handleValidationErrors
];

// Farmer profile validation
const validateFarmerProfile = [
  body('farmDetails.farmName')
    .trim()
    .notEmpty()
    .withMessage('Farm name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Farm name must be between 2 and 100 characters'),
  
  body('farmDetails.farmAddress.street')
    .notEmpty()
    .withMessage('Farm street address is required'),
  
  body('farmDetails.farmAddress.city')
    .notEmpty()
    .withMessage('Farm city is required'),
  
  body('farmDetails.farmAddress.state')
    .notEmpty()
    .withMessage('Farm state is required'),
  
  body('farmDetails.farmAddress.pincode')
    .matches(/^\d{6}$/)
    .withMessage('Please provide a valid 6-digit pincode'),
  
  body('farmDetails.farmSize')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Farm size must be a positive number'),
  
  body('farmDetails.farmingType')
    .optional()
    .isIn(['organic', 'conventional', 'mixed'])
    .withMessage('Invalid farming type'),
  
  body('farmDetails.description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Farm description cannot exceed 1000 characters'),
  
  handleValidationErrors
];

// Address validation
const validateAddress = [
  body('street')
    .trim()
    .notEmpty()
    .withMessage('Street address is required'),
  
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  
  body('pincode')
    .matches(/^\d{6}$/)
    .withMessage('Please provide a valid 6-digit pincode'),
  
  handleValidationErrors
];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateProduct,
  validateOrder,
  validateReview,
  validateComplaint,
  validateFarmerProfile,
  validateAddress,
  handleValidationErrors
};
