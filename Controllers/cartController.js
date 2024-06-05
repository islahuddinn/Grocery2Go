const catchAsync = require("../Utils/catchAsync");
const Cart = require("../Models/cartModel");
const Product = require("../Models/productsModel");

exports.addToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity } = req.body;
  const cart = await Cart.findOne({ user: req.user.id });

  if (cart) {
    const productIndex = cart.products.findIndex(
      (p) => p.product.toString() === productId
    );
    if (productIndex > -1) {
      cart.products[productIndex].quantity += quantity;
    } else {
      cart.products.push({ product: productId, quantity });
    }
    await cart.save();
  } else {
    await Cart.create({
      user: req.user.id,
      products: [{ product: productId, quantity }],
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Product added to cart",
  });
});

exports.getCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user.id }).populate(
    "products.product"
  );

  if (!cart) {
    return res.status(200).json({
      success: true,
      status: 200,
      data: {
        cart: null,
        totalProducts: 0,
        totalPrice: 0,
      },
    });
  }

  const totalProducts = cart.products.length;
  const totalPrice = cart.products.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  res.status(200).json({
    success: true,
    status: 200,
    data: {
      cart,
      totalProducts,
      totalPrice,
    },
  });
});

/////
exports.updateCart = catchAsync(async (req, res, next) => {
  const { productId, quantity, volume } = req.body;

  // Find the cart for the logged-in user
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return res.status(404).json({
      success: false,
      status: 400,
      message: "Cart not found",
    });
  }

  // Find the product in the cart
  const productIndex = cart.products.findIndex(
    (item) => item.product.toString() === productId
  );

  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      message: "Product not found in cart",
    });
  }

  // Update the product details
  if (quantity !== undefined) {
    cart.products[productIndex].quantity = quantity;
  }
  if (volume !== undefined) {
    cart.products[productIndex].volume = volume;
  }

  // Save the updated cart
  await cart.save();

  res.status(200).json({
    success: true,
    status: 200,
    message: "Cart updated successfully",
    data: cart,
  });
});
