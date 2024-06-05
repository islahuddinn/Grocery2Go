const catchAsync = require("../Utils/catchAsync");
const Order = require("../Models/orderModel");
const Cart = require("../Models/cartModel");
const User = require("../Models/userModel");
const Shop = require("../Models/shopsModel");
const Rider = require("../Models/riderModel");
const { sendNotificationToNearbyRiders } = require("../utils/notification");

exports.createOrder = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user.id }).populate(
    "products.product"
  );

  if (!cart || cart.products.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Your cart is empty",
    });
  }

  const shop = await Shop.findById(cart.products[0].product.shop);

  const totalPrice = cart.products.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  const order = await Order.create({
    user: req.user.id,
    shop: shop.id,
    products: cart.products,
    totalPrice,
  });

  // Clear user's cart
  await Cart.findOneAndDelete({ user: req.user.id });

  // Notify nearby riders
  sendNotificationToNearbyRiders(req.user.location.coordinates, order.id);

  res.status(201).json({
    success: true,
    data: order,
  });
});

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { orderId, status } = req.body;

  const order = await Order.findByIdAndUpdate(
    orderId,
    { status },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: order,
  });
});

exports.getUserOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ user: req.user.id }).populate(
    "products.product"
  );

  res.status(200).json({
    success: true,
    data: orders,
  });
});
