const Cart = require('../models/Cart');
const Product = require('../models/Product');

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findByCustomer(req.user._id);
    
    if (!cart) {
      cart = await Cart.create({
        customer: req.user._id,
        items: [],
        totalAmount: 0,
        totalItems: 0
      });
    }

    res.status(200).json({
      success: true,
      cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching cart'
    });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid quantity are required'
      });
    }

    // Check if product exists and is available
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.isAvailable || product.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }

    if (quantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} ${product.unit} available`
      });
    }

    // Check minimum order quantity
    if (quantity < product.minimumOrderQuantity) {
      return res.status(400).json({
        success: false,
        message: `Minimum order quantity is ${product.minimumOrderQuantity} ${product.unit}`
      });
    }

    // Check maximum order quantity
    if (product.maximumOrderQuantity && quantity > product.maximumOrderQuantity) {
      return res.status(400).json({
        success: false,
        message: `Maximum order quantity is ${product.maximumOrderQuantity} ${product.unit}`
      });
    }

    // Get or create cart
    let cart = await Cart.findByCustomer(req.user._id);
    if (!cart) {
      cart = await Cart.create({
        customer: req.user._id,
        items: [],
        totalAmount: 0,
        totalItems: 0
      });
    }

    // Add item to cart
    await cart.addItem(product, quantity);

    // Populate product details for response
    cart = await Cart.findByCustomer(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding item to cart'
    });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/update
// @access  Private
const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get cart
    let cart = await Cart.findByCustomer(req.user._id);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Validate quantity
    if (quantity > 0) {
      if (!product.isAvailable || product.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Product is not available'
        });
      }

      if (quantity > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.quantity} ${product.unit} available`
        });
      }

      if (quantity < product.minimumOrderQuantity) {
        return res.status(400).json({
          success: false,
          message: `Minimum order quantity is ${product.minimumOrderQuantity} ${product.unit}`
        });
      }

      if (product.maximumOrderQuantity && quantity > product.maximumOrderQuantity) {
        return res.status(400).json({
          success: false,
          message: `Maximum order quantity is ${product.maximumOrderQuantity} ${product.unit}`
        });
      }
    }

    // Update item
    await cart.updateItem(productId, quantity);

    // Get updated cart
    cart = await Cart.findByCustomer(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating cart item'
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:productId
// @access  Private
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    // Get cart
    let cart = await Cart.findByCustomer(req.user._id);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Remove item
    await cart.removeItem(productId);

    // Get updated cart
    cart = await Cart.findByCustomer(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error removing item from cart'
    });
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart/clear
// @access  Private
const clearCart = async (req, res) => {
  try {
    // Get cart
    let cart = await Cart.findByCustomer(req.user._id);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Clear cart
    await cart.clearCart();

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error clearing cart'
    });
  }
};

// @desc    Get cart summary for checkout
// @route   GET /api/cart/summary
// @access  Private
const getCartSummary = async (req, res) => {
  try {
    const cart = await Cart.findByCustomer(req.user._id);
    
    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Cart is empty',
        cart: null,
        summary: {
          subtotal: 0,
          deliveryCharge: 0,
          totalAmount: 0,
          totalItems: 0
        }
      });
    }

    // Calculate delivery charge (simplified logic)
    let deliveryCharge = 0;
    if (cart.totalAmount < 500) {
      deliveryCharge = 40; // Fixed delivery charge for orders under 500
    }

    const summary = {
      subtotal: cart.totalAmount,
      deliveryCharge,
      totalAmount: cart.totalAmount + deliveryCharge,
      totalItems: cart.totalItems
    };

    res.status(200).json({
      success: true,
      cart,
      summary
    });
  } catch (error) {
    console.error('Get cart summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching cart summary'
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary
};
