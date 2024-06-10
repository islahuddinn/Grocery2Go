const catchAsync = require("../Utils/catchAsync");
const Cart = require("../Models/cartModel");
const Factory = require("../Controllers/handleFactory");
const User = require("../Models/userModel");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const geolib = require("geolib");

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
//// remove product from cart

exports.removeFromCart = catchAsync(async (req, res, next) => {
  const { productId } = req.body;
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Cart not found",
    });
  }

  const productIndex = cart.products.findIndex(
    (p) => p.product.toString() === productId
  );

  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Product not found in cart",
    });
  }

  cart.products.splice(productIndex, 1);
  await cart.save();

  res.status(200).json({
    success: true,
    status: 200,
    message: "Product removed from cart",
    data: cart,
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
  console.log("route hitted");
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
      status: 404,
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

// exports.updateCart = Factory.updateOne(Cart);
exports.deleteCart = Factory.deleteOne(Cart);

///////----Checkout------/////

exports.checkout = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { location } = req.body; // User provided location (optional)

  // Get user's cart
  let cart = await Cart.findOne({ user: user.id }).populate("products.product");
  if (!cart || cart.products.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Your cart is empty",
    });
  }

  // Update the cart with default fee and speed values if not already set
  if (!cart.adminFeePercentage) cart.adminFeePercentage = 0.05;
  if (!cart.riderFeePerKm) cart.riderFeePerKm = 1;
  if (!cart.averageSpeedKmPerHour) cart.averageSpeedKmPerHour = 30;

  await cart.save();

  // Calculate total price of products
  let totalPrice = 0;
  cart.products.forEach((item) => {
    totalPrice += item.product.price * item.quantity;
  });

  // Get user location (either from user profile or provided location)
  const userLocation = location || user.location;
  if (!userLocation) {
    return res.status(400).json({
      success: false,
      message: "User location is required",
    });
  }

  // Assuming shop location is fixed for this example (e.g., main warehouse location)
  const shopLocation = {
    latitude: 40.712776,
    longitude: -74.005974,
  };

  // Calculate distance between user and shop
  const distance =
    geolib.getDistance(
      {
        latitude: userLocation.coordinates[0],
        longitude: userLocation.coordinates[1],
      },
      { latitude: shopLocation.latitude, longitude: shopLocation.longitude }
    ) / 1000; // Convert meters to kilometers

  // Calculate additional fees
  const adminFee = totalPrice * cart.adminFeePercentage;
  const riderFee = distance * cart.riderFeePerKm;

  // Estimate delivery time (in hours)
  const deliveryTime = distance / cart.averageSpeedKmPerHour;

  // Create a payment intent with Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round((totalPrice + adminFee + riderFee) * 100), // amount in cents
    currency: "usd",
    metadata: { integration_check: "accept_a_payment" },
  });

  res.status(200).json({
    success: true,
    message: "Checkout summary",
    data: {
      cart,
      totalPrice,
      adminFee,
      riderFee,
      deliveryTime,
      paymentIntent,
    },
  });
});
