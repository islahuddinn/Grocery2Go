const catchAsync = require("../Utils/catchAsync");
const AppError = require("../Utils/appError");
const Order = require("../Models/orderModel");
const Cart = require("../Models/cartModel");
const User = require("../Models/userModel");
const Shop = require("../Models/shopsModel");
const {
  SendNotification,
  SendNotificationMultiCast,
} = require("../Utils/notificationSender");

// exports.createOrder = catchAsync(async (req, res, next) => {
//   const cart = await Cart.findOne({ user: req.user.id }).populate(
//     "products.product"
//   );

//   if (!cart || cart.products.length === 0) {
//     return next(new AppError("Your cart is empty", 400));
//   }

//   const shop = await Shop.findById(cart.products[0].product.shop);

//   const totalPrice = cart.products.reduce(
//     (total, item) => total + item.product.price * item.quantity,
//     0
//   );

//   const order = await Order.create({
//     user: req.user.id,
//     shop: shop.id,
//     products: cart.products,
//     totalPrice,
//   });

//   // Clear user's cart
//   await Cart.findOneAndDelete({ user: req.user.id });

//   // Notify nearby riders
//   sendNotificationToNearbyRiders(req.user.location.coordinates, order.id);

//   res.status(201).json({
//     success: true,
//     data: order,
//   });
// });

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

/////get user orders-----////

// exports.getUserOrders = catchAsync(async (req, res, next) => {
//   const orders = await Order.find({ customer: req.user.id });
//   console.log(orders, "here is the order details ");

//   res.status(200).json({
//     success: true,
//     status: 200,
//     data: orders,
//   });
// });

exports.getUserOrders = catchAsync(async (req, res, next) => {
  // Find all orders for the current user and populate the shop details
  const orders = await Order.find({ customer: req.user.id }).populate({
    path: "shop",
    select: "shopTitle location owner",
  });

  if (!orders || orders.length === 0) {
    return next(new AppError("No orders found for this user", 404));
  }

  res.status(200).json({
    success: true,
    status: 200,
    data: orders,
  });
});

/////----get shop all orders-----////

exports.getAllShopOrders = catchAsync(async (req, res, next) => {
  const shopId = req.params.id;

  // Find the shop by ID to ensure it exists
  const shop = await Shop.findById(shopId);

  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }

  // Find all orders associated with the shop
  const orders = await Order.find({ shop: shopId })
    .populate({
      path: "customer",
      select: "name email",
    })
    .populate({
      path: "driver",
      select: "name email",
    })
    .populate({
      path: "products.shop",
      select: "shopTitle location owner",
    })
    .populate({
      path: "vendor",
      select: "name email",
    });

  if (!orders || orders.length === 0) {
    return next(new AppError("No orders found for this shop", 404));
  }

  // Returning the shop details and orders
  res.status(200).json({
    success: true,
    status: 200,
    data: {
      shop: {
        shopTitle: shop.shopTitle,
        location: shop.location,
        owner: shop.owner,
      },
      orders,
    },
  });
});

/////----get all orders of the riders----/////

/////-----order-details-----////

// exports.getOrderDetails = catchAsync(async (req, res, next) => {
//   const orderId = req.params.id;

//   // Find the order by ID and populate necessary fields
//   const order = await Order.findById(orderId)
//     .populate({
//       path: "products.shop",
//       select: "shopTitle images location categories",
//     })
//     .populate({
//       path: "products.grocery",
//       select: "productName price volume productImages",
//     })
//     .populate("customer", "firstName email image")
//     .populate("driver", "name");

//   if (!order) {
//     return next(new AppError("Order not found", 404));
//   }

//   const productDetails = [];
//   const shopDetails = [];

//   // Iterate over the products in the order to get their details
//   for (let item of order.products) {
//     const shop = item.shop;
//     if (!shop) {
//       return next(new AppError("Shop not found", 404));
//     }

//     // Find the corresponding category within the shop
//     const category = shop.categories.id(item.category);
//     if (!category) {
//       return res.status(404).json({
//         success: false,
//         status: 404,
//         message: `Category with ID ${item.category} not found in shop ${shop._id}`,
//       });
//     }

//     // Find the corresponding grocery within the category
//     const grocery = category.groceries.id(item.grocery);
//     if (!grocery) {
//       return res.status(404).json({
//         success: false,
//         status: 404,
//         message: `Grocery with ID ${item.grocery} not found in category ${category._id}`,
//       });
//     }

//     // Extract product details
//     productDetails.push({
//       name: grocery.productName,
//       volume: grocery.volume,
//       images: grocery.productImages,
//       price: grocery.price,
//       quantity: item.quantity,
//     });

//     // Extract shop details (unique shops only)
//     if (!shopDetails.find((shopDetail) => shopDetail.name === shop.shopTitle)) {
//       shopDetails.push({
//         name: shop.shopTitle,
//         image: shop.images,
//         location: shop.location,
//       });
//     }
//   }

//   // Prepare order summary
//   const orderSummary = {
//     itemsTotal: order.itemsTotal,
//     serviceFee: order.serviceFee,
//     adminFee: order.adminFee,
//     totalPayment: order.totalPayment,
//     paymentStatus: order.paymentStatus,
//     deliveryFee: order.deliveryCharges,
//     deliveryPaymentStatus: order.deliveryPaymentStatus,
//   };

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Order details retrieved successfully",
//     order: {
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       customer: {
//         name: order.customer.name,
//         email: order.customer.email,
//       },
//       shopDetails,
//       productDetails,
//       Rider: order.driver ? order.driver.id : null,
//       orderSummary,
//     },
//   });
// });

exports.getOrderDetails = catchAsync(async (req, res, next) => {
  const orderId = req.params.id;

  const order = await Order.findById(orderId)
    .populate({
      path: "products.shop",
      select: "shopTitle images location groceries",
    })
    .populate({
      path: "products.grocery",
      select: "productName price volume productImages categoryName",
    })
    .populate("customer", "firstName email image")
    .populate("driver", "name");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  const productDetails = [];
  const shopDetails = [];

  for (let item of order.products) {
    const shop = item.shop;
    if (!shop) {
      return next(new AppError("Shop not found", 404));
    }

    const grocery = shop.groceries.id(item.grocery);
    if (!grocery) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: `Grocery with ID ${item.grocery} not found in shop ${shop._id}`,
      });
    }

    const category = grocery.categoryName
      .map((cat) => cat.categoryName)
      .join(", ");

    productDetails.push({
      name: grocery.productName,
      category,
      volume: grocery.volume,
      images: grocery.productImages,
      price: grocery.price,
      quantity: item.quantity,
    });

    if (!shopDetails.find((shopDetail) => shopDetail.name === shop.shopTitle)) {
      shopDetails.push({
        name: shop.shopTitle,
        image: shop.image,
        location: shop.location,
      });
    }
  }

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
        name: order.customer.firstName,
        email: order.customer.email,
        image: order.customer.image,
      },
      shopDetails,
      productDetails,
      rider: order.driver ? order.driver.name : null,
      orderSummary,
    },
  });
});

/////----Accept or Reject the order function for rider-------////

exports.acceptOrRejectOrderByRider = catchAsync(async (req, res, next) => {
  const { orderId, action } = req.body;

  // Find the order by ID
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // // Check if the order is still pending
  // if (order.orderStatus !== "accepted") {
  //   return next(new AppError("Order is not accepted by owner", 400));
  // }

  // Handle the action
  if (action === "reject") {
    const allRiders = await User.find({ userType: "Rider" });
    console.log(allRiders, "All riders");
    // const FCMTokens = allRiders.map((rider) => rider.deviceToken);
    // await SendNotificationMultiCast({
    //   tokens: FCMTokens,
    //   title: "New order delivery request ",
    //   body: `Accept or reject the order ${order}`,
    // });
    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order rejected by any rider and notifies again to all riders",
      order,
    });
  } else if (action === "accept") {
    order.orderStatus = "ready for pickup";
    order.driver = req.user.id;
    await order.save();

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order accepted by rider",
      driver: order.driver,
    });
  } else {
    return next(new AppError("Invalid action, use 'accept' or 'reject'", 400));
  }
});

////////------Accept or Reject order by Owner -----////
exports.acceptOrRejectOrderByOwner = catchAsync(async (req, res, next) => {
  const { orderId, action } = req.body;

  // Find the order by ID
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // //////Check if the order is still pending
  if (order.orderStatus !== "pending") {
    return next(new AppError("Order is not in pending state ", 400));
  }

  // Handle the action
  if (action === "accept") {
    order.orderStatus = "accepted";
    // order.driver = req.user.id;
    await order.save();

    // Send a notification to the all riders about the new order
    const allRiders = await User.find({ userType: "Rider" });
    console.log(allRiders, "All riders");
    // const FCMTokens = allRiders.map((rider) => rider.deviceToken);
    // console.log(FCMTokens, "FCMToken of all riders");

    // await SendNotificationMultiCast({
    //   tokens: FCMTokens,
    //   title: "New order on shop",
    //   body: `Accept or reject the order ${order}`,
    // });
    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order accepted and notifies to all riders",
      order,
    });
  } else if (action === "reject") {
    const customer = await User.findById(order.customer).populate(
      "deviceToken"
    );
    const FCMToken = customer.deviceToken;
    console.log(customer, "here is the deviceToken of costume bhaya");
    console.log(FCMToken, "here is the FCMToken of costume g");
    // await SendNotification({
    //   token: FCMToken,
    //   title: "Your order is rejected by the owner ",
    //   body: `Owner rejected the order ${order}`,
    // });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order rejected",
    });
  } else {
    return next(new AppError("Invalid action, use 'accept' or 'reject'", 400));
  }
});
