const express = require('express');
const router = express.Router();
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { validateProduct } = require('../middleware/validation');
const { uploadMultiple, handleUploadError } = require('../middleware/upload');

const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getFarmerProducts,
  searchProducts,
  getFeaturedProducts,
  getProductsByCategory
} = require('../controllers/productController');

// Public routes
router.get('/', optionalAuth, getProducts);
router.get('/search', optionalAuth, searchProducts);
router.get('/featured', optionalAuth, getFeaturedProducts);
router.get('/category/:category', optionalAuth, getProductsByCategory);
router.get('/:id', optionalAuth, getProductById);

// Image upload routes
router.post('/upload-images', protect, authorize('farmer'), uploadMultiple, handleUploadError, (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const imageUrls = req.files.map(file => file.path);
    
    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      images: imageUrls
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading images'
    });
  }
});

// Farmer routes
router.get('/farmer/my-products', protect, authorize('farmer'), getFarmerProducts);
router.post('/', protect, authorize('farmer'), validateProduct, createProduct);
router.put('/:id', protect, authorize('farmer'), validateProduct, updateProduct);
router.delete('/:id', protect, authorize('farmer'), deleteProduct);

module.exports = router;
