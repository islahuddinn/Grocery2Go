const catchAsync = require("../Utils/catchAsync");
const AppError = require("../Utils/appError");
const List = require("../Models/listModel");
const Factory = require("../Controllers/handleFactory");
const User = require("../Models/userModel");
const Order = require("../Models/orderModel");
const { SendNotification } = require("../Utils/notificationSender");
const Notification = require("../Models/notificationModel");
const Shop = require("../Models/shopsModel");
const Rating = require("../Models/ratingModel");
const { calculateDeliveryCharges } = require("../Utils/helper");
const {
  createStripeCustomer,
  createPaymentIntent,
} = require("../Utils/stripe");
// const { default: Stripe } = require("stripe");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.addProductsToList = catchAsync(async (req, res, next) => {
  const { listTitle, items } = req.body;
  const listOrderNumber = `ORD-${Date.now()}`;

  const newList = await List.create({
    customer: req.user.id,
    listTitle,
    listOrderNumber: listOrderNumber,
    items: items,
    endLocation: null,
    listStatus: "pending",
  });

  res.status(200).json({
    success: true,
    status: 200,
    data: newList,
  });
});

exports.editProductInList = catchAsync(async (req, res, next) => {
  const { listId, itemId, productName, quantity } = req.body;

  const list = await List.findById(listId);

  if (!list) {
    return next(new AppError("List not found", 404));
  }

  const item = list.items.id(itemId);
  if (!item) {
    return next(new AppError("Items not found in the list", 404));
  }

  if (productName) item.productName = productName;
  if (quantity) item.quantity = quantity;

  await list.save();

  res.status(200).json({
    success: true,
    status: 200,
    data: list,
  });
});

exports.deleteProductFromList = catchAsync(async (req, res, next) => {
  const { listId, itemId } = req.body;

  const list = await List.findById(listId);

  if (!list) {
    return next(new AppError("List not found", 404));
  }

  const item = list.items.id(itemId);
  if (!item) {
    return next(new AppError("Items not found in the list", 404));
  }
  list.items.pull(itemId);
  await list.save();

  res.status(200).json({
    success: true,
    status: 200,
    data: list,
  });
});

// Get all riders

exports.getAllRiders = catchAsync(async (req, res, next) => {
  const riders = await User.find({ userType: "Rider" }).select(
    "-password -__v"
  ); // Exclude password and version key

  // Get ratings for each rider
  const riderRatingsPromises = riders.map(async (rider) => {
    const ratings = await Rating.find({ to: rider._id, toDriver: true }).select(
      "stars createdAt -_id"
    );
    const averageRating = ratings.length
      ? (
          ratings.reduce((acc, rating) => acc + rating.stars, 0) /
          ratings.length
        ).toFixed(2)
      : "0";
    return {
      rider,
      ratings,
      averageRating,
    };
  });

  const ridersWithRatings = await Promise.all(riderRatingsPromises);

  res.status(200).json({
    success: true,
    status: 200,
    message: "Riders retrieved successfully",
    data: ridersWithRatings,
  });
});

// Get details of a specific rider
exports.getRiderDetails = catchAsync(async (req, res, next) => {
  const riderId = req.params.id;

  const rider = await User.findOne({ _id: riderId, userType: "Rider" }).select(
    "-password -__v"
  );

  if (!rider) {
    return next(new AppError("Rider not found", 404));
  }

  // Fetch all ratings for the rider
  const ratings = await Rating.find({ to: rider._id }).select(
    "from stars comment createdAt -_id"
  );

  // Calculate average rating
  const averageRating = ratings.length
    ? (
        ratings.reduce((acc, rating) => acc + rating.stars, 0) / ratings.length
      ).toFixed(2)
    : "0";

  res.status(200).json({
    success: true,
    status: 200,
    message: "Rider details retrieved successfully",
    data: {
      rider,
      averageRating,
      ratings,
    },
  });
});

// // ------Select rider for list order delivery ----- ////

// exports.requestRider = catchAsync(async (req, res, next) => {
//   const { endLocation, riderId, listId } = req.body;
//   const { user } = req;

//   // Validate that the rider exists
//   const rider = await User.findOne({ _id: riderId, userType: "Rider" });
//   if (!rider) {
//     return next(new AppError("Rider not found", 404));
//   }
//   // Retrieve the list by listId
//   const list = await List.findById(listId).populate("user");
//   if (!list) {
//     return next(new AppError("List not found", 404));
//   }

//   // Extract product names from the list
//   const productNames = list.items.map((item) => item.productName);
//   console.log("List product names:", productNames);

//   // Fetch all products with their prices from the shop model
//   const shopProducts = await Shop.aggregate([
//     { $unwind: "$categories" },
//     { $unwind: "$categories.groceries" },
//     { $match: { "categories.groceries.productName": { $in: productNames } } },
//     {
//       $project: {
//         "categories.groceries.productName": 1,
//         "categories.groceries.price": 1,
//       },
//     },
//   ]);

//   console.log("Shop products details:", shopProducts);

//   // Create a map for product prices
//   const priceMap = {};
//   shopProducts.forEach((shopProduct) => {
//     const productName = shopProduct.categories.groceries.productName;
//     const productPrice = shopProduct.categories.groceries.price;
//     priceMap[productName] = productPrice;
//   });

//   console.log("Mapped prices:", priceMap);

//   // // Check if all items have a price
//   // for (const item of list.items) {
//   //   if (!priceMap[item.productName]) {
//   //     return res.status(404).json({
//   //       success: false,
//   //       status: 404,
//   //       message: `Price not found for item: ${item.productName} or item not available`,
//   //     });
//   //   }
//   // }

//   // Generate a unique order number (e.g., using a timestamp)
//   const orderNumber = `ORD-${Date.now()}`;

//   // Calculate items total and construct products array
//   const products = [];
//   let itemsTotal = 0;

//   for (const item of list.items) {
//     const price = priceMap[item.productName];
//     console.log("what the heck is this price:", price);
//     const totalPrice = item.quantity * price;
//     itemsTotal += totalPrice;
//     products.push({
//       productName: item.productName,
//       quantity: item.quantity,
//       price: price,
//     });
//   }

//   // Assuming startLocation is the first shop's location for simplicity
//   const shop = await Shop.findOne({
//     "groceries.productName": productNames[0],
//   });
//   if (!shop || !shop.location) {
//     return next(
//       new AppError("Shop not found or invalid coordinates/location", 404)
//     );
//   }
//   const startLocation = shop.location;
//   console.log("rider start:", startLocation);
//   const serviceFee = 0.5;
//   const adminFee = 0.1;
//   const totalPayment = itemsTotal + serviceFee + adminFee;

//   // Calculate delivery charges
//   const deliveryCharges = calculateDeliveryCharges(startLocation, endLocation);
//   console.log("Calculated delivery charges:", deliveryCharges);

//   // Create the order
//   const newOrder = await Order.create({
//     orderNumber,
//     customer: list.user._id,
//     listItems: products,
//     startLocation: startLocation,
//     endLocation: endLocation,
//     // driver
//     itemsTotal: itemsTotal,
//     serviceFee,
//     adminFee,
//     totalPayment: totalPayment,
//     deliveryCharges: deliveryCharges,
//   });

//   ///// Notification for the rider
//   // const FCMToken = rider.deviceToken;
//   // const notification = await Notification.create({
//   //   sender: user._id,
//   //   receiver: rider._id,
//   //   data: `New order from ${user.firstName}. Please accept or reject the order.`,
//   // });

//   // await SendNotification({
//   //   token: FCMToken,
//   //   title: `New Order from ${user.firstName}`,
//   //   body: "Please accept or reject the order delivery request.",
//   // });

//   // Return the order details
//   res.status(201).json({
//     success: true,
//     status: 201,
//     message: "Order created successfully, rider has been notified.",
//     order: {
//       orderId: newOrder.id,
//       orderNumber: newOrder.orderNumber,
//       orderStatus: newOrder.orderStatus,
//       startLocation: newOrder.startLocation,
//       endLocation: newOrder.endLocation,
//       customer: newOrder.customer,
//       itemsTotal: newOrder.itemsTotal,
//       serviceFee: newOrder.serviceFee,
//       adminFee: newOrder.adminFee,
//       totalPayment: newOrder.totalPayment,
//       paymentStatus: newOrder.paymentStatus,
//       deliveryCharges: newOrder.deliveryCharges,
//       deliveryPaymentStatus: newOrder.deliveryPaymentStatus,
//       listItems: newOrder.listItems,
//       // notification,
//     },
//   });
// });
// exports.requestRider = catchAsync(async (req, res, next) => {
//   const { endLocation, riderId, listId } = req.body;
//   const { user } = req;

//   // Validate that the rider exists
//   const rider = await User.findOne({ _id: riderId, userType: "Rider" });
//   if (!rider) {
//     return next(new AppError("Rider not found", 404));
//   }

//   // Retrieve the list by listId
//   const list = await List.findById(listId).populate("user");
//   if (!list) {
//     return next(new AppError("List not found", 404));
//   }

//   // Extract product names from the list
//   // const productNames = list.items.map((item) => item.productName);

//   // // Fetch all products with their prices from the shop model
//   // const shopProducts = await Shop.aggregate([
//   //   { $unwind: "$groceries" },
//   //   { $match: { "groceries.productName": { $in: productNames } } },
//   //   {
//   //     $project: {
//   //       "groceries.productName": 1,
//   //       "groceries.price": 1,
//   //     },
//   //   },
//   // ]);

//   // Create a map for product prices
//   // const priceMap = {};
//   // shopProducts.forEach((shopProduct) => {
//   //   const productName = shopProduct.groceries.productName;
//   //   const productPrice = shopProduct.groceries.price;
//   //   priceMap[productName] = productPrice;
//   // });

//   // Generate a unique order number (e.g., using a timestamp)
//   // const orderNumber = `ORD-${Date.now()}`;

//   // Calculate items total and construct products array
//   // const products = [];
//   // let itemsTotal = 0;

//   // for (const item of list.items) {
//   //   const price = priceMap[item.productName];
//   //   if (!price) {
//   //     return res.status(404).json({
//   //       success: false,
//   //       status: 404,
//   //       message: `Price not found for item: ${item.productName} or item not available`,
//   //     });
//   //   }
//   //   const totalPrice = item.quantity * price;
//   //   itemsTotal += totalPrice;
//   //   products.push({
//   //     productName: item.productName,
//   //     quantity: item.quantity,
//   //     price: price,
//   //   });
//   // }

//   // Assuming startLocation is the first shop's location for simplicity
//   // const shop = await Shop.findOne({
//   //   "groceries.productName": productNames[0],
//   // });
//   // if (!shop || !shop.location) {
//   //   return next(
//   //     new AppError("Shop not found or invalid coordinates/location", 404)
//   //   );
//   // }
//   // const startLocation = shop.location;

//   // const serviceFee = 0.5;
//   // const adminFee = 0.1;
//   // const totalPayment = itemsTotal + serviceFee + adminFee;

//   // Calculate delivery charges
//   // const deliveryCharges = calculateDeliveryCharges(startLocation, endLocation);

//   // // Create the order
//   // const newOrder = await Order.create({
//   //   orderNumber,
//   //   customer: list.user._id,
//   //   listItems: products,
//   //   startLocation: startLocation,
//   //   endLocation: endLocation,
//   //   itemsTotal: itemsTotal,
//   //   serviceFee,
//   //   adminFee,
//   //   totalPayment: totalPayment,
//   //   deliveryCharges: deliveryCharges,
//   // });

//   // Notification for the rider
//   // const FCMToken = rider.deviceToken;
//   // const notification = await Notification.create({
//   //   sender: user._id,
//   //   receiver: rider._id,
//   //   data: `New order from ${user.firstName}. Please accept or reject the order.`,
//   // });
//   // await SendNotification({
//   //   token: FCMToken,
//   //   title: `New Order from ${user.firstName}`,
//   //   body: "Please accept or reject the order delivery request.",
//   // });

//   // Return the order details
//   res.status(201).json({
//     success: true,
//     status: 201,
//     message: "Rider has been notified.",
//     order: {
//       // orderId: newOrder.id,
//       // orderNumber: newOrder.orderNumber,
//       // orderStatus: newOrder.orderStatus,
//       // startLocation: newOrder.startLocation,
//       // endLocation: newOrder.endLocation,
//       // customer: newOrder.customer,
//       // itemsTotal: newOrder.itemsTotal,
//       // serviceFee: newOrder.serviceFee,
//       // adminFee: newOrder.adminFee,
//       // totalPayment: newOrder.totalPayment,
//       // paymentStatus: newOrder.paymentStatus,
//       // deliveryCharges: newOrder.deliveryCharges,
//       // deliveryPaymentStatus: newOrder.deliveryPaymentStatus,
//       // listItems: newOrder.listItems,
//       // notification,
//     },
//   });
// });
exports.requestRider = catchAsync(async (req, res, next) => {
  const { endLocation, riderId, listId } = req.body;
  const { user } = req;

  // Validate that the rider exists
  const rider = await User.findOne({ _id: riderId, userType: "Rider" });
  if (!rider) {
    return next(new AppError("Rider not found", 404));
  }
  // Retrieve the list by listId
  const list = await List.findById(listId).populate("customer");
  if (!list) {
    return next(new AppError("List not found", 404));
  }
  if (!list.requestedRiders) {
    list.requestedRiders = [];
  }
  // Check if the rider has already been requested
  if (list.requestedRiders.includes(riderId)) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "Rider already requested.",
    });
  }

  // Add the rider to the requested riders
  list.endLocation = endLocation;
  list.requestedRiders = riderId;
  // list.requestedRiders.push(riderId);
  list.endLocation = endLocation;
  await list.save();
  // Notify the rider (mock notification for now)
  // const FCMToken = rider.deviceToken;
  // const notification = await Notification.create({
  //   sender: user._id,
  //   receiver: rider._id,
  //   data: `New delivery request from ${user.firstName}. Please accept or reject the request.`,
  // });
  // await SendNotification({
  //   token: FCMToken,
  //   title: `New Delivery Request from ${user.firstName}`,
  //   body: "Please accept or reject the delivery request.",
  // });
  // const listStatus = (await list.listStatus) === "pending";
  // await list.save();
  // Return rider with list details and status
  res.status(200).json({
    success: true,
    status: 200,
    message: "Rider notified successfully.",
    rider: {
      id: rider._id,
      name: rider.name,
      deviceToken: rider.deviceToken,
      deliveryAddress: endLocation,
      list: {
        id: list._id,
        items: list.items,
        user: list.user,
        listStatus: list.listStatus,
      },
    },
  });
});

/////-----Aaccept or Reject list order by rider -----////

// exports.acceptOrRejectOrder = catchAsync(async (req, res, next) => {
//   const { listId, action } = req.body;

//   // Retrieve the list by listId
//   const list = await List.findById(listId).populate("customer");
//   if (!list) {
//     return next(new AppError("List not found", 404));
//   }

//   /// Extract product names from the list
//   const productNames = list.items.map((item) => item.productName);

//   // Fetch all products with their prices from the shop model
//   const shopProducts = await Shop.aggregate([
//     { $unwind: "$groceries" },
//     { $match: { "groceries.productName": { $in: productNames } } },
//     {
//       $project: {
//         "groceries.productName": 1,
//         "groceries.price": 1,
//       },
//     },
//   ]);

//   ///// Create a map for product prices
//   const priceMap = {};
//   shopProducts.forEach((shopProduct) => {
//     const productName = shopProduct.groceries.productName;
//     const productPrice = shopProduct.groceries.price;
//     priceMap[productName] = productPrice;
//   });

//   ///// Generate a unique order number (e.g., using a timestamp)
//   const orderNumber = `ORD-${Date.now()}`;

//   ////// Calculate items total and construct products array
//   const products = [];
//   let itemsTotal = 0;

//   for (const item of list.items) {
//     const price = priceMap[item.productName];
//     if (!price) {
//       return res.status(404).json({
//         success: false,
//         status: 404,
//         message: `Price not found for item: ${item.productName} or item not available`,
//       });
//     }
//     const totalPrice = item.quantity * price;
//     itemsTotal += totalPrice;
//     products.push({
//       productName: item.productName,
//       quantity: item.quantity,
//       price: price,
//     });
//   }

//   ///// Assuming startLocation is the first shop's location for simplicity
//   const shop = await Shop.findOne({
//     "groceries.productName": productNames[0],
//   });
//   if (!shop || !shop.location) {
//     return next(
//       new AppError("Shop not found or invalid coordinates/location", 404)
//     );
//   }
//   const startLocation = shop.location;

//   const serviceFee = 0.5;
//   const adminFee = 0.1;
//   const totalPayment = itemsTotal + serviceFee + adminFee;

//   /// // Calculate delivery charges
//   // const deliveryCharges = calculateDeliveryCharges(startLocation, endLocation);

//   // Create the order
//   const newOrder = await Order.create({
//     orderNumber,
//     customer: list.user._id,
//     listItems: products,
//     startLocation: startLocation,
//     endLocation: endLocation,
//     itemsTotal: itemsTotal,
//     serviceFee,
//     adminFee,
//     totalPayment: totalPayment,
//     // deliveryCharges: deliveryCharges,
//   });

//   // Handle the action
//   if (action === "accept") {
//     newOrder.orderStatus = "rider accepted";
//     newOrder.driver = req.user.id;
//     await newOrder.save();

//     // Send a notification to the customer about the order status change
//     // Assuming you have a function to send notifications
//     // sendNotificationToCustomer(order.customer, 'Your order is ready for pickup');

//     return res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Order accepted and status updated to ready for pickup",
//       newOrder,
//     });
//   } else if (action === "reject") {
//     // Optionally, you can log the rejection or notify the customer about the rejection
//     // sendNotificationToCustomer(newOrder.customer, 'Your order has been rejected');

//     return next(new AppError("Order rejected ", 200));
//   } else {
//     return next(new AppError("Invalid action use accept/reject ", 400));
//   }
// });

exports.acceptOrRejectListByRider = catchAsync(async (req, res, next) => {
  const { listId, action } = req.body;
  console.log(listId, "listId here");

  const list = await List.findById(listId).populate("customer"); // Fetch the list and populate the customer details

  if (!list) {
    return next(new AppError("List not found", 404));
  }
  // if ((list.listStatus = "accepted")) {
  //   return next(new AppError("list order allready accepted", 200));
  // }

  if (action === "reject") {
    list.riderRejectedList.push(req.user._id);
    await list.save();

    //////Notify customer about rider rejected list

    ///// Notify all riders
    // const allRiders = await User.find({ userType: "Rider" });
    // const FCMTokens = allRiders.map((rider) => rider.deviceToken);
    // await SendNotificationMultiCast({
    //   tokens: FCMTokens,
    //   title: "New order delivery request",
    //   body: `Accept or reject the order ${list}`,
    // });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "List rejected by a rider and notified to customer",
      data: list,
    });
  } else if (action === "accept") {
    // list.listStatus = "accepted";
    // list.requestedRiders = null;
    // list.driver = req.user.id;
    // list.isAccepted = true;
    // await list.save();
    list.listStatus = "accepted";
    // list.requestedRiders = list.requestedRiders.filter(
    //   (rider) => rider.toString() !== req.user.id.toString()
    // );
    if (list.requestedRiders) {
      list.requestedRiders = list.requestedRiders.filter(
        (rider) => rider.toString() !== req.user.id.toString()
      );
    }
    list.driver = req.user.id;
    list.isAccepted = true;
    await list.save();
    const user = req.user;
    const orderNumber = `ORD-${Date.now()}`;
    const customer = list.customer;

    // Create the order
    const newOrder = await Order.create({
      orderNumber,
      customer: customer._id,
      listItems: list.items,
      startLocation: user.location,
      endLocation: list.endLocation,
      driver: user.id,
      orderStatus: "accepted by rider",
      orderType: "listOrder",
      isdeliveryInProgress: false,
    });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order accepted by rider",
      listOrder: newOrder,
      customer: customer,
    });
  } else {
    return next(new AppError("Invalid action, use 'accept' or 'reject'", 400));
  }
});

////// ----- Rider Buying Grocery ----- /////

// exports.updateListItemAvailability = catchAsync(async (req, res, next) => {
//   const { orderId, updatedItems } = req.body;

//   if (!orderId || !updatedItems || !Array.isArray(updatedItems)) {
//     return next(new AppError("Invalid input data", 400));
//   }

//   const order = await Order.findById(orderId);
//   if (!order) {
//     return next(new AppError("Order not found", 404));
//   }
//   const riderDetails = await User.findById(order.driver).populate(
//     "firstName image location"
//   );
//   if (!riderDetails) {
//     return next(new AppError("Driver not found in the order", 404));
//   }
//   // console.log("mr rider details are here:", riderDetails);
//   // Fetch serviceFee and adminFee from settings
//   const otherCharges = await Order.findOne();
//   if (!otherCharges) {
//     return next(new AppError("Other charges not found", 500));
//   }

//   const { serviceFee, tax, tip } = otherCharges;
//   let itemsTotal = 0;
//   let totalPayment = 0;
//   const deliveryCharges = order.deliveryCharges || 2.0;

//   for (const item of order.listItems) {
//     const updatedItem = updatedItems.find(
//       (ui) => ui.productName === item.productName
//     );
//     if (updatedItem) {
//       item.isAvailable = updatedItem.isAvailable;

//       if (updatedItem.isAvailable) {
//         const shopProduct = await Shop.findOne(
//           { "categories.groceries.productName": item.productName },
//           { "categories.groceries.$": 1 }
//         );

//         if (!shopProduct) {
//           return res.status(404).json({
//             success: false,
//             status: 404,
//             message: `Price not found for item: ${item.productName}`,
//           });
//         }

//         const grocery = shopProduct.categories[0].groceries[0];
//         const totalPrice = item.quantity * grocery.price;
//         itemsTotal += totalPrice;
//       }
//     }
//   }

//   totalPayment = itemsTotal + serviceFee + tax;

//   order.itemsTotal = itemsTotal.toFixed(2);
//   order.serviceFee = serviceFee;
//   order.tax = tax;
//   order.tip = tip;
//   order.totalPayment = totalPayment.toFixed(2);
//   order.orderStatus = "buying grocery";
//   order.deliveryCharges = deliveryCharges;

//   await order.save();

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "List item availability and billing details updated successfully",
//     order,
//     // paymentIntent,
//     riderDetails,
//   });
// });

exports.updateListItemAvailability = catchAsync(async (req, res, next) => {
  const { orderId, updatedItems, itemsTotal } = req.body;

  if (!orderId || !updatedItems || !Array.isArray(updatedItems)) {
    return next(new AppError("Invalid input data", 400));
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  const riderDetails = await User.findById(order.driver).select(
    "firstName lastName image location"
  );
  if (!riderDetails) {
    return next(new AppError("Driver not found in the order", 404));
  }

  const { serviceFee, tax, tip } = order;
  let totalPayment = 0;
  const deliveryCharges = calculateDeliveryCharges(
    order.startLocation,
    order.endLocation
  );
  console.log(deliveryCharges, "Here is the delivery charges ");

  const availableItems = updatedItems.filter((item) => item.isAvailable);

  for (const updatedItem of updatedItems) {
    const orderItem = order.listItems.find(
      (item) => item.productName === updatedItem.productName
    );

    if (!orderItem) {
      return next(
        new AppError(
          `Product ${updatedItem.productName} is not in the order`,
          400
        )
      );
    }

    orderItem.isAvailable = updatedItem.isAvailable;
    // orderItem.price = updatedItem.price;

    // if (updatedItem.isAvailable) {
    //   itemsTotal += orderItem.quantity * updatedItem.price;
    // }
  }

  totalPayment = itemsTotal + serviceFee + tax + deliveryCharges;

  order.itemsTotal = itemsTotal;
  order.serviceFee = serviceFee;
  order.tax = tax;
  order.tip = tip;
  order.totalPayment = totalPayment;
  order.orderStatus = "buying grocery";

  await order.save();

  const orderSummary = availableItems.map((item) => {
    const orderItem = order.listItems.find(
      (orderItem) => orderItem.productName === item.productName
    );
    return {
      productName: item.productName,
      quantity: orderItem.quantity,
      // price: item.price,
      // total: (orderItem.quantity * item.price).toFixed(2),
    };
  });

  res.status(200).json({
    success: true,
    status: 200,
    message: "List item availability and billing details updated successfully",
    order: {
      orderId: order._id,
      orderStatus: order.orderStatus,
      itemsTotal: order.itemsTotal,
      serviceFee: order.serviceFee,
      tax: order.tax,
      tip: order.tip,
      totalPayment: order.totalPayment,
      deliveryCharges: deliveryCharges,
    },
    orderSummary,
    riderDetails,
  });
});

//////-----Send bill to the customer with order details----////

// exports.sendListBill = catchAsync(async (req, res, next) => {
//   const { orderId } = req.body;

//   if (!orderId) {
//     return next(new AppError("Invalid input data", 400));
//   }

//   const order = await Order.findById(orderId).populate("customer");
//   if (!order) {
//     return next(new AppError("Order not found", 404));
//   }

//   const riderDetails = await User.findById(order.driver).select(
//     "firstName image location"
//   );
//   if (!riderDetails) {
//     return next(new AppError("Driver not found in the order", 404));
//   }

//   const settings = await Order.findOne();
//   if (!settings) {
//     return next(
//       new AppError("Service fee, Admin fee or tax fee not found", 500)
//     );
//   }

//   const { serviceFee, tax } = settings;
//   let itemsTotal = 0;

//   for (const item of order.listItems) {
//     if (item.isAvailable) {
//       const shopProduct = await Shop.findOne(
//         { "categories.groceries.productName": item.productName },
//         { "categories.$": 1 }
//       );

//       if (!shopProduct) {
//         return res.status(404).json({
//           success: false,
//           status: 404,
//           message: `Price not found for item: ${item.productName}`,
//         });
//       }

//       const grocery = shopProduct.categories[0].groceries.find(
//         (g) => g.productName === item.productName
//       );
//       const totalPrice = item.quantity * grocery.price;
//       itemsTotal += totalPrice;
//     }
//   }

//   const totalPayment = itemsTotal + serviceFee + tax;

//   order.itemsTotal = itemsTotal.toFixed(2);
//   order.serviceFee = serviceFee;
//   order.tax = tax;
//   order.totalPayment = totalPayment.toFixed(2);
//   order.orderStatus = "buying grocery";

//   await order.save();

//   const FCMToken = order.customer.deviceToken;
//   const paymentIntent = await stripe.paymentIntents.create({
//     amount: Math.round(totalPayment * 100),
//     currency: "usd",
//     customer: order.customer.stripeCustomerId,
//     description: `Payment for order ${order.orderNumber}`,
//   });

//   //// Notify the customer
//   // await SendNotification({
//   //   token: FCMToken,
//   //   title: "Bill Details",
//   //   body: `Your order ${
//   //     order.orderNumber
//   //   } payment is pending. Total payment: ${totalPayment.toFixed(2)}`,
//   // });

//   // await Notification.create({
//   //   sender: order.driver,
//   //   receiver: order.customer._id,
//   //   data: `Your order ${
//   //     order.orderNumber
//   //   } bill is ready. Total payment: ${totalPayment.toFixed(2)}`,
//   // });

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "List items and billing details send successfully",
//     order,
//     paymentIntentId: paymentIntent._id,
//     tip: paymentIntent.amount_details,
//     riderDetails,
//   });
// });

exports.sendListBill = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;

  if (!orderId) {
    return next(new AppError("Invalid input data", 400));
  }

  const order = await Order.findById(orderId).populate("customer");
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  const riderDetails = await User.findById(order.driver).select(
    "firstName lastName image location"
  );
  if (!riderDetails) {
    return next(new AppError("Driver not found in the order", 404));
  }
  const user = req.user;
  console.log(user, "Here is the userDetails");

  const { serviceFee, tax, itemsTotal } = order;
  // let itemsTotal = 0;

  const availableItems = order.listItems.filter((item) => item.isAvailable);

  // for (const item of availableItems) {
  //   const totalPrice = item.quantity * item.price;
  //   itemsTotal += totalPrice;
  // }

  const totalPayment = itemsTotal + serviceFee + tax;

  order.itemsTotal = itemsTotal;
  order.serviceFee = serviceFee;
  order.tax = tax;
  order.totalPayment = totalPayment;
  order.orderStatus = "buying grocery";

  await order.save();
  console.log(totalPayment, "Here is the totalpayment");
  if (!user.stripeCustomerId) {
    const customer = await createStripeCustomer(user);
    console.log(customer, "Here is the customer stripe id");
    user.stripeCustomerId = customer;
    await user.save();
  }
  // const paymentIntent = await stripe.paymentIntents.create({
  //   amount: Math.round(totalPayment * 100),
  //   currency: "usd",
  //   customer: order.customer.stripeCustomerId,
  //   description: `Payment for order ${order.orderNumber}`,
  //   metadata: { tipAmount: tip.toString() },
  // });
  const total = order.itemsTotal;
  const customerId = user.stripeCustomerId;

  const paymentIntent = await createPaymentIntent(
    user,
    total,
    customerId,
    orderId
  );
  const orderSummary = {
    itemsTotal: order.itemsTotal,
    serviceFee: order.serviceFee,
    adminFee: order.adminFee,
    tax: order.tax,
    tip: order.tip,
    totalPayment: order.totalPayment,
  };

  res.status(200).json({
    success: true,
    status: 200,
    message: "List items and billing details sent successfully",
    data: {
      startLocation: order.startLocation,
      endLocation: order.endLocation,
      _id: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      rejectedBy: order.rejectedBy,
      listItems: availableItems.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        isAvailable: item.isAvailable,
        _id: item._id,
        // price: item.price,
      })),
      customer: order.customer._id,
      driver: order.driver._id,
      deliveryPaymentStatus: order.deliveryPaymentStatus,
      isdeliveryInProgress: order.isdeliveryInProgress,
      serviceFee: order.serviceFee,
      adminFee: order.adminFee,
      tax: order.tax,
      savings: order.savings,
      paymentStatus: order.paymentStatus,
      shopAcceptedOrder: order.shopAcceptedOrder,
      shopRejectedOrder: order.shopRejectedOrder,
      products: order.products,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      __v: order.__v,
      deliveryCharges: order.deliveryCharges,
      itemsTotal: order.itemsTotal,
      totalPayment: order.totalPayment,
      riderEarnings: order.riderEarnings,
      // tip: order.tip,
      orderSummary,
      paymentIntent: {
        id: paymentIntent.id,
        customer: paymentIntent.customer,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        clientSecret: paymentIntent.client_secret,
        metadata: paymentIntent.metadata,
      },
      riderDetails,
    },
  });
});

////----verify-payment intent----///

exports.verifyPaymentIntent = catchAsync(async (req, res, next) => {
  const { paymentIntentId, orderId } = req.body;

  // Validate input
  if (!paymentIntentId) {
    return next(new AppError("Payment Intent ID is required", 400));
  }

  try {
    // Retrieve the PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check the payment status
    if (paymentIntent.status !== "succeeded") {
      return next(new AppError("Payment was not successful", 400));
    }
    const order = await Order.findById(orderId);
    console.log(order, "here is the order ");
    order.paymentStatus = "paid";
    await order.save();

    // Payment is successful, you can now process the order or other business logic
    res.status(200).json({
      success: true,
      status: 200,
      message: "Payment verified successfully",
      data: paymentIntent,
    });
  } catch (error) {
    // Handle errors from Stripe or other issues
    return next(
      new AppError(`Payment verification failed: ${error.message}`, 500)
    );
  }
});
exports.verifyDeliveryPaymentIntent = catchAsync(async (req, res, next) => {
  const { paymentIntentId, orderId } = req.body;

  // Validate input
  if (!paymentIntentId) {
    return next(new AppError("Payment Intent ID is required", 400));
  }

  try {
    // Retrieve the PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check the payment status
    if (paymentIntent.status !== "succeeded") {
      return next(new AppError("Payment was not successful", 400));
    }
    const order = await Order.findById(orderId);
    console.log(order, "here is the order ");
    order.deliveryPaymentStatus = "paid";
    await order.save();

    // Payment is successful, you can now process the order or other business logic
    res.status(200).json({
      success: true,
      status: 200,
      message: "Payment verified successfully",
      data: paymentIntent,
    });
  } catch (error) {
    // Handle errors from Stripe or other issues
    return next(
      new AppError(`Payment verification failed: ${error.message}`, 500)
    );
  }
});

////----add tip to the user ------ ////

exports.addTipToRider = catchAsync(async (req, res, next) => {
  const { orderId, tipAmount, paymentIntentId } = req.body;

  if (!orderId || tipAmount == null || !paymentIntentId) {
    return next(new AppError("Invalid input data", 400));
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // Update the tip amount and total payment
  order.tip = tipAmount;
  order.totalPayment = (
    parseFloat(order.totalPayment) + parseFloat(tipAmount)
  ).toFixed(2);

  ///// Update the payment intent with the new amount
  const newTotalAmount = Math.round(order.totalPayment * 100);
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
      amount: newTotalAmount,
      metadata: { tipAmount: tipAmount.toString() },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to update payment intent",
      error: error.message,
    });
  }

  await order.save();

  res.status(200).json({
    success: true,
    status: 200,
    message: "Tip added and payment intent updated successfully",
    data: {
      order,
      orderSummary: {
        itemsTotal: order.itemsTotal,
        serviceFee: order.serviceFee,
        adminFee: order.adminFee,
        tax: order.tax,
        tip: order.tip,
        totalPayment: order.totalPayment,
      },
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      },
    },
  });
});

/////-----rider reached -----////
exports.riderArrived = catchAsync(async (req, res, next) => {
  const { orderId, riderStatus } = req.body;

  if (!orderId || !riderStatus) {
    return next(new AppError("orderId or riderStatus not provided", 400));
  }
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("order not found", 404));
  }
  order.riderStatus = riderStatus;
  await order.save();
  res.status(200).json({
    success: true,
    status: 200,
    message: "Rider successfully arrived at distination",
    data: { order },
  });
});
exports.payDeliveryCharges = async (req, res, next) => {
  const { orderId } = req.body;
  console.log("here is the order:   ", orderId);

  if (!orderId) {
    return next(new AppError("Invalid input data", 400));
  }

  let order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("Order not found ", 404));
  }

  // Ensure delivery charges are present
  // if (!order.deliveryCharges) {
  //   return next(new AppError("Delivery charges not found in order", 400));
  // }
  const deliveryCharges = calculateDeliveryCharges(
    order.startLocation,
    order.endLocation
  );
  console.log(deliveryCharges, "here are the delivery charges");

  // const deliveryCharges = parseFloat(order.deliveryCharges);
  const deliveryChargesAmount = Math.round(deliveryCharges * 100);
  console.log(deliveryChargesAmount, "here are the delivery charges");
  const user = req.user;
  let paymentIntent;
  try {
    if (!user.stripeCustomerId) {
      const customer = await createStripeCustomer(user);
      console.log(customer, "Here is the customer stripe id");
      user.stripeCustomerId = customer;
      await user.save();
    }

    const customerId = user.stripeCustomerId;
    const tip = order.tip ? tip : 0;
    const total = deliveryChargesAmount + tip;
    console.log(total, tip, "here is the rider earned amount");

    paymentIntent = await createPaymentIntent(user, total, customerId, orderId);
    order.deliveryPaymentStatus = "paid";
    order.riderEarnings = total;

    await order.save();
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to create payment intent",
      error: error.message,
    });
  }
  const paymentIntentInformation = {
    id: paymentIntent.id,
    customer: paymentIntent.customer,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    clientSecret: paymentIntent.client_secret,
    metadata: paymentIntent.metadata,
  };

  let orderCopy = JSON.parse(JSON.stringify(order));
  orderCopy.paymentIntentData = paymentIntentInformation;

  res.status(200).json({
    success: true,
    status: 200,
    message: "Payment intent for delivery charges created successfully",
    data: {
      order: orderCopy,
      // paymentIntentData: {
      //   id: paymentIntent.id,
      //   customer: paymentIntent.customer,
      //   amount: paymentIntent.amount,
      //   currency: paymentIntent.currency,
      //   clientSecret: paymentIntent.client_secret,
      //   metadata: paymentIntent.metadata,
      // },
    },
  });
};

/////-----Mark the order completed------////

exports.markOrderAsCompleted = catchAsync(async (req, res, next) => {
  const { orderId, paymentIntentId } = req.body;

  // Validate input
  if (!orderId || !paymentIntentId) {
    return next(new AppError("Invalid input", 400));
  }

  // Find the order by ID
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // Check if the order status is already delivered
  if (order.orderStatus === "delivered") {
    return next(new AppError("Order is allready delivered", 400));
  }

  // Retrieve the payment intent from Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (!paymentIntent) {
    return next(new AppError("Payment intent not found", 404));
  }

  // Check if the payment intent status is succeeded
  if (paymentIntent.status !== "succeeded") {
    return next(new AppError("Payment intent is not successfull", 400));
  }

  // Update the order statuses
  order.paymentStatus = "paid";
  order.deliveryPaymentStatus = "paid";
  order.orderStatus = "delivered";

  // Save the updated order
  await order.save();

  // Respond with success
  res.status(200).json({
    success: true,
    status: 200,
    message: "Order marked as completed successfully",
    data: order,
  });
});

/////----get all user lists
exports.getUserLists = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  console.log(userId, "here is the user id");
  const lists = await List.find({ customer: userId })
    .populate("shop", "shopTitle")
    .populate("rider", "name");

  if (!lists || lists.length === 0) {
    return res.status(200).json({
      success: true,
      status: 200,
      message: "User have no list",
      data: lists,
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Lists retrieved successfully",
    data: lists,
  });
});

exports.getAllLists = Factory.getAll(List);
exports.updateList = Factory.updateOne(List);
exports.getOneList = Factory.getOne(List);
exports.deleteList = Factory.deleteOne(List);
exports.getOneOrder = Factory.getOne(Order);
