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
    status: 200,
    data: orders,
  });
});
/////-----order-details-----////

exports.getOrderDetails = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;

  // Find the order by ID and populate necessary fields
  const order = await Order.findById(orderId)
    .populate({
      path: "products.shop",
      select: "shopTitle images location",
    })
    .populate({
      path: "products.grocery",
      select: "productName price volume productImages",
    })
    .populate("customer", "name")
    .populate("driver", "name");

  if (!order) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Order not found",
    });
  }

  // Extract shop details
  const shopDetails = order.products.map((item) => ({
    name: item.shop.shopTitle,
    image: item.shop.images,
    location: item.shop.location,
  }));

  // Extract product details
  // const grocery = category.groceries.id(item.grocery);
  // if (!grocery) {
  //   return res.status(404).json({
  //     success: false,
  //     status: 404,
  //     message: `Grocery with ID ${item.grocery} not found in category ${category._id}`,
  //   });
  // }
  const productDetails = order.products.map((item) => ({
    image: item.productImages,
    title: item.productName,
    quantity: item.quantity,
    price: item.price,
    volume: item.volume,
  }));

  // Prepare order summary
  const orderSummary = {
    itemsTotal: order.itemsTotal,
    serviceFee: order.serviceFee,
    adminFee: order.adminFee,
    totalPayment: order.totalPayment,
    paymentStatus: order.paymentStatus,
    deliveryFee: order.deliveryCharges,
    deliveryPaymentStatus: order.deliveryPaymentStatus,
  };

  res.status(200).json({
    success: true,
    status: 200,
    message: "Order details retrieved successfully",
    order: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      shopDetails,
      productDetails,
      rider: order.driver ? order.driver.name : null,
      orderSummary,
    },
  });
});
