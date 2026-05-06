const Product = require('../models/Product');
const User = require('../models/User');

// @desc    Get all products (public)
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const { category, minPrice, maxPrice, isOrganic, sortBy, search } = req.query;

    // Build filter
    const filter = { isAvailable: true, quantity: { $gt: 0 } };
    
    if (category) filter.category = category;
    if (isOrganic === 'true') filter.isOrganic = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort
    let sort = {};
    switch (sortBy) {
      case 'price-low':
        sort = { price: 1 };
        break;
      case 'price-high':
        sort = { price: -1 };
        break;
      case 'rating':
        sort = { 'rating.average': -1 };
        break;
      case 'newest':
        sort = { createdAt: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    const products = await Product.find(filter)
      .populate('farmer', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching products'
    });
  }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('farmer', 'name farmDetails.farmName farmDetails.farmAddress');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching product'
    });
  }
};

// @desc    Create new product (Farmer only)
// @route   POST /api/products
// @access  Private/Farmer
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      discountPrice,
      quantity,
      unit,
      category,
      images,
      isOrganic,
      tags,
      season,
      harvestDate,
      expiryDate,
      storageInstructions,
      nutritionalInfo,
      minimumOrderQuantity,
      maximumOrderQuantity
    } = req.body;

    // Get farmer details
    const farmer = await User.findById(req.user._id);
    if (!farmer || farmer.role !== 'farmer') {
      return res.status(403).json({
        success: false,
        message: 'Only farmers can create products'
      });
    }

    if (!farmer.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your farmer account is not approved yet'
      });
    }

    // Create product
    const product = await Product.create({
      name,
      description,
      price,
      discountPrice,
      quantity,
      unit,
      category,
      images: images || [],
      farmer: req.user._id,
      farmerName: farmer.name,
      isOrganic: isOrganic || false,
      tags: tags || [],
      season,
      harvestDate,
      expiryDate,
      storageInstructions,
      nutritionalInfo,
      minimumOrderQuantity: minimumOrderQuantity || 1,
      maximumOrderQuantity
    });

    const populatedProduct = await Product.findById(product._id)
      .populate('farmer', 'name');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: populatedProduct
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update product (Farmer only)
// @route   PUT /api/products/:id
// @access  Private/Farmer
const updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product belongs to the farmer
    if (product.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own products'
      });
    }

    // Update product fields
    const updateFields = [
      'name', 'description', 'price', 'discountPrice', 'quantity', 
      'unit', 'category', 'images', 'isOrganic', 'tags', 'season',
      'harvestDate', 'expiryDate', 'storageInstructions', 'nutritionalInfo',
      'minimumOrderQuantity', 'maximumOrderQuantity', 'isAvailable', 'isFeatured'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();

    const updatedProduct = await Product.findById(product._id)
      .populate('farmer', 'name');

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete product (Farmer only)
// @route   DELETE /api/products/:id
// @access  Private/Farmer
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product belongs to the farmer
    if (product.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own products'
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting product'
    });
  }
};

// @desc    Get farmer's products
// @route   GET /api/products/farmer/my-products
// @access  Private/Farmer
const getFarmerProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { status, category } = req.query;

    // Build filter
    const filter = { farmer: req.user._id };
    
    if (status === 'available') {
      filter.isAvailable = true;
      filter.quantity = { $gt: 0 };
    } else if (status === 'out-of-stock') {
      filter.isAvailable = true;
      filter.quantity = 0;
    } else if (status === 'unavailable') {
      filter.isAvailable = false;
    }
    
    if (category) filter.category = category;

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get farmer products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching farmer products'
    });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
const searchProducts = async (req, res) => {
  try {
    const { q: query, category, minPrice, maxPrice, isOrganic } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Build filter
    const filter = {
      isAvailable: true,
      quantity: { $gt: 0 },
      $text: { $search: query }
    };

    if (category) filter.category = category;
    if (isOrganic === 'true') filter.isOrganic = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const products = await Product.find(filter, { score: { $meta: 'textScore' } })
      .populate('farmer', 'name')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      products,
      query,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error searching products'
    });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;

    const products = await Product.find({
      isFeatured: true,
      isAvailable: true,
      quantity: { $gt: 0 }
    })
    .populate('farmer', 'name')
    .sort({ 'rating.average': -1 })
    .limit(limit);

    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching featured products'
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const products = await Product.findByCategory(category)
      .populate('farmer', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments({
      category,
      isAvailable: true,
      quantity: { $gt: 0 }
    });

    res.status(200).json({
      success: true,
      products,
      category,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching products by category'
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getFarmerProducts,
  searchProducts,
  getFeaturedProducts,
  getProductsByCategory
};
