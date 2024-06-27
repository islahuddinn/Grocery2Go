const catchAsync = require("../Utils/catchAsync");
const Order = require("../Models/orderModel");
const Cart = require("../Models/cartModel");
const User = require("../Models/userModel");
const Shop = require("../Models/shopsModel");
const Rider = require("../Models/riderModel");
const {
  sendNotificationToNearbyRiders,
} = require("../Utils/notificationSender");

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
      select: "shopTitle images location categories",
    })
    .populate({
      path: "products.grocery",
      select: "productName price volume productImages",
    })
    .populate("customer", "firstName email image")
    .populate("driver", "name");

  if (!order) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Order not found",
    });
  }

  const productDetails = [];
  const shopDetails = [];

  // Iterate over the products in the order to get their details
  for (let item of order.products) {
    const shop = item.shop;
    if (!shop) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Shop not found",
      });
    }

    // Find the corresponding category within the shop
    const category = shop.categories.id(item.category);
    if (!category) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: `Category with ID ${item.category} not found in shop ${shop._id}`,
      });
    }

    // Find the corresponding grocery within the category
    const grocery = category.groceries.id(item.grocery);
    if (!grocery) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: `Grocery with ID ${item.grocery} not found in category ${category._id}`,
      });
    }

    // Extract product details
    productDetails.push({
      name: grocery.productName,
      volume: grocery.volume,
      images: grocery.productImages,
      price: grocery.price,
      quantity: item.quantity,
    });

    // Extract shop details (unique shops only)
    if (!shopDetails.find((shopDetail) => shopDetail.name === shop.shopTitle)) {
      shopDetails.push({
        name: shop.shopTitle,
        image: shop.images,
        location: shop.location,
      });
    }
  }

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
      customer: {
        name: order.customer.name,
        email: order.customer.email,
      },
      shopDetails,
      productDetails,
      Rider: order.driver ? order.driver.name : null,
      orderSummary,
    },
  });
});

/////----Accept or Reject the order function-------////
// controllers/orderController.js

exports.acceptOrRejectOrder = catchAsync(async (req, res, next) => {
  const { orderId, action } = req.body;

  // Find the order by ID
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Order not found",
    });
  }

  // Check if the order is still pending
  if (order.orderStatus !== "pending") {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "Order is not in pending status",
    });
  }

  // Handle the action
  if (action === "accept") {
    order.orderStatus = "ready for pickup";
    await order.save();

    // Send a notification to the customer about the order status change
    // Assuming you have a function to send notifications
    // sendNotificationToCustomer(order.customer, 'Your order is ready for pickup');

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order accepted and status updated to ready for pickup",
      order,
    });
  } else if (action === "reject") {
    // Optionally, you can log the rejection or notify the customer about the rejection
    // sendNotificationToCustomer(order.customer, 'Your order has been rejected');

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order rejected",
    });
  } else {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "Invalid action. Use 'accept' or 'reject'",
    });
  }
});
