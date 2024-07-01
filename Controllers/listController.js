const catchAsync = require("../Utils/catchAsync");
const List = require("../Models/listModel");
const Factory = require("../Controllers/handleFactory");
const User = require("../Models/userModel");
const Order = require("../Models/orderModel");
const { SendNotification } = require("../Utils/notificationSender");
const Notification = require("../Models/notificationModel");
const Shop = require("../Models/shopsModel");
const { calculateDeliveryCharges } = require("../Utils/helper");
// const { default: Stripe } = require("stripe");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.addProductsToList = catchAsync(async (req, res, next) => {
  const { items, shopId } = req.body;
  const newList = await List.create({
    user: req.user.id,
    items: items,
    shop: shopId,
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
    return res.status(404).json({
      success: false,
      status: 404,
      message: "List not found",
    });
  }

  const item = list.items.id(itemId);
  if (!item) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Item not found in list",
    });
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
    return res.status(404).json({
      success: false,
      status: 404,
      message: "List not found",
    });
  }

  const item = list.items.id(itemId);
  if (!item) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Item not found in list",
    });
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
  const riders = await User.find({ userType: "Rider" });

  res.status(200).json({
    success: true,
    status: 200,
    message: "Riders retrieved successfully",
    data: riders,
  });
});

// Get details of a specific rider
exports.getRiderDetails = catchAsync(async (req, res, next) => {
  const { riderId } = req.params;

  const rider = await User.findOne({ _id: riderId, userType: "Rider" });

  if (!rider) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Rider not found",
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Rider details retrieved successfully",
    data: rider,
  });
});

// // ------Select rider for list order delivery ----- ////

exports.requestRider = catchAsync(async (req, res, next) => {
  const { endLocation, riderId, listId } = req.body;
  const { user } = req;

  // Validate that the rider exists
  const rider = await User.findOne({ _id: riderId, userType: "Rider" });
  if (!rider) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Rider not found",
    });
  }
  // Retrieve the list by listId
  const list = await List.findById(listId).populate("user");
  if (!list) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "List not found",
    });
  }

  // Extract product names from the list
  const productNames = list.items.map((item) => item.productName);
  console.log("List product names:", productNames);

  // Fetch all products with their prices from the shop model
  const shopProducts = await Shop.aggregate([
    { $unwind: "$categories" },
    { $unwind: "$categories.groceries" },
    { $match: { "categories.groceries.productName": { $in: productNames } } },
    {
      $project: {
        "categories.groceries.productName": 1,
        "categories.groceries.price": 1,
      },
    },
  ]);

  console.log("Shop products details:", shopProducts);

  // Create a map for product prices
  const priceMap = {};
  shopProducts.forEach((shopProduct) => {
    const productName = shopProduct.categories.groceries.productName;
    const productPrice = shopProduct.categories.groceries.price;
    priceMap[productName] = productPrice;
  });

  console.log("Mapped prices:", priceMap);

  // // Check if all items have a price
  // for (const item of list.items) {
  //   if (!priceMap[item.productName]) {
  //     return res.status(404).json({
  //       success: false,
  //       status: 404,
  //       message: `Price not found for item: ${item.productName}`,
  //     });
  //   }
  // }

  // Generate a unique order number (e.g., using a timestamp)
  const orderNumber = `ORD-${Date.now()}`;

  // Calculate items total and construct products array
  const products = [];
  let itemsTotal = 0;

  for (const item of list.items) {
    const price = priceMap[item.productName];
    console.log("what the heck is this price:", price);
    const totalPrice = item.quantity * price;
    itemsTotal += totalPrice;
    products.push({
      productName: item.productName,
      quantity: item.quantity,
      price: price,
    });
  }

  // Assuming startLocation is the first shop's location for simplicity
  const shop = await Shop.findOne({
    "categories.groceries.productName": productNames[0],
  });
  if (!shop || !shop.location || !shop.location) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Shop not found or invalid coordinates for the first product",
    });
  }
  const startLocation = shop.location;
  console.log("rider start:", startLocation);
  const serviceFee = 0.5;
  const adminFee = 0.1;
  const totalPayment = itemsTotal + serviceFee + adminFee;

  // Calculate delivery charges
  const deliveryCharges = calculateDeliveryCharges(startLocation, endLocation);
  console.log("Calculated delivery charges:", deliveryCharges);

  // Create the order
  const newOrder = await Order.create({
    orderNumber,
    customer: list.user._id,
    listItems: products,
    startLocation: startLocation,
    endLocation: endLocation,
    // driver
    itemsTotal: itemsTotal,
    serviceFee,
    adminFee,
    totalPayment: totalPayment,
    deliveryCharges: deliveryCharges,
  });

  ///// Notification for the rider
  // const FCMToken = rider.deviceToken;
  // const notification = await Notification.create({
  //   sender: user._id,
  //   receiver: rider._id,
  //   data: `New order from ${user.firstName}. Please accept or reject the order.`,
  // });

  // await SendNotification({
  //   token: FCMToken,
  //   title: `New Order from ${user.firstName}`,
  //   body: "Please accept or reject the order delivery request.",
  // });

  // Return the order details
  res.status(201).json({
    success: true,
    status: 201,
    message: "Order created successfully, rider has been notified.",
    order: {
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      orderStatus: newOrder.orderStatus,
      startLocation: newOrder.startLocation,
      endLocation: newOrder.endLocation,
      customer: newOrder.customer,
      itemsTotal: newOrder.itemsTotal,
      serviceFee: newOrder.serviceFee,
      adminFee: newOrder.adminFee,
      totalPayment: newOrder.totalPayment,
      paymentStatus: newOrder.paymentStatus,
      deliveryCharges: newOrder.deliveryCharges,
      deliveryPaymentStatus: newOrder.deliveryPaymentStatus,
      listItems: newOrder.listItems,
      // notification,
    },
  });
});

/////-----Aaccept or Reject list order by rider -----////

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
    order.driver = req.user.id;
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

////// ----- Rider Buying Grocery ----- /////

exports.updateListItemAvailability = catchAsync(async (req, res, next) => {
  const { orderId, updatedItems } = req.body;

  if (!orderId || !updatedItems || !Array.isArray(updatedItems)) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "Invalid input data",
    });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Order not found",
    });
  }
  const riderDetails = await User.findById(order.driver).populate(
    "firstName image location"
  );
  if (!riderDetails) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Driver not found in the order",
    });
  }
  console.log("mr rider details are here:", riderDetails);
  // Fetch serviceFee and adminFee from settings
  const otherCharges = await Order.findOne();
  if (!otherCharges) {
    return res.status(500).json({
      success: false,
      status: 500,
      message: "otherCharges not found",
    });
  }

  const { serviceFee, tax, tip } = otherCharges;
  let itemsTotal = 0;
  let totalPayment = 0;
  const deliveryCharges = order.deliveryCharges || 2.0;

  for (const item of order.listItems) {
    const updatedItem = updatedItems.find(
      (ui) => ui.productName === item.productName
    );
    if (updatedItem) {
      item.isAvailable = updatedItem.isAvailable;

      if (updatedItem.isAvailable) {
        const shopProduct = await Shop.findOne(
          { "categories.groceries.productName": item.productName },
          { "categories.groceries.$": 1 }
        );

        if (!shopProduct) {
          return res.status(404).json({
            success: false,
            status: 404,
            message: `Price not found for item: ${item.productName}`,
          });
        }

        const grocery = shopProduct.categories[0].groceries[0];
        const totalPrice = item.quantity * grocery.price;
        itemsTotal += totalPrice;
      }
    }
  }

  totalPayment = itemsTotal + serviceFee + tax;

  order.itemsTotal = itemsTotal.toFixed(2);
  order.serviceFee = serviceFee;
  order.tax = tax;
  order.tip = tip;
  order.totalPayment = totalPayment.toFixed(2);
  order.orderStatus = "buying grocery";
  order.deliveryCharges = deliveryCharges;

  await order.save();

  res.status(200).json({
    success: true,
    status: 200,
    message: "List item availability and billing details updated successfully",
    order,
    // paymentIntent,
    riderDetails,
  });
});

//////-----Send bill to the customer with order details----////

exports.sendListBill = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;

  // if (!orderId || !Array.isArray(updatedItems)) {
  //   return res.status(400).json({
  //     success: false,
  //     status: 400,
  //     message: "Invalid input data",
  //   });
  // }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Order not found",
    });
  }

  const riderDetails = await User.findById(order.driver).select(
    "firstName image location"
  );
  if (!riderDetails) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Driver not found in the order",
    });
  }

  // Fetch serviceFee and adminFee from settings (assuming they are stored in a global settings collection)
  const otherCharges = await Order.findOne();
  if (!otherCharges) {
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Service fee and admin fee not found",
    });
  }

  const { serviceFee, adminFee } = otherCharges;
  let itemsTotal = 0;

  for (const item of order.listItems) {
    const updatedItem = updatedItems.find(
      (ui) => ui.productName === item.productName
    );
    if (updatedItem) {
      item.isAvailable = updatedItem.isAvailable;

      if (updatedItem.isAvailable) {
        const shopProduct = await Shop.findOne(
          { "categories.groceries.productName": item.productName },
          { "categories.$": 1 }
        );

        if (!shopProduct) {
          return res.status(404).json({
            success: false,
            status: 404,
            message: `Price not found for item: ${item.productName}`,
          });
        }

        const grocery = shopProduct.categories[0].groceries.find(
          (g) => g.productName === item.productName
        );
        const totalPrice = item.quantity * grocery.price;
        itemsTotal += totalPrice;
      }
    }
  }

  const totalPayment = itemsTotal + serviceFee + tax;

  order.itemsTotal = itemsTotal.toFixed(2);
  order.serviceFee = serviceFee;
  order.tax = tax;
  order.tip = tip;
  order.totalPayment = totalPayment.toFixed(2);
  order.orderStatus = "buying grocery";

  await order.save();
  const FCMToken = order.customer.deviceToken;
  const paymentIntent = await stripe.paymentIntents.create({});

  // Notify the customer
  await SendNotification({
    token: FCMToken,
    title: "send bill to the customer",
    message: `Your order ${order.orderNumber} payment is pending.`,
  });
  await Notification.create({
    sender: order.rider._id,
    receiver: customer._id,
    data: `New order from ${user.firstName}. Please accept or reject the order.`,
  });

  res.status(200).json({
    success: true,
    status: 200,
    message: "List item availability and billing details updated successfully",
    order,
    paymentIntent,
    riderDetails,
  });
});

////----add tip to the user ------ ////
exports.addTipToRider = catchAsync(async (req, res, next) => {
  const { orderId, tipAmount, paymentIntentId } = req.body;

  // if (!orderId || tipAmount == null || !paymentIntentId) {
  //   return res.status(400).json({
  //     success: false,
  //     status: 400,
  //     message: "Invalid input data",
  //   });
  // }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Order not found",
    });
  }

  // Update the tip amount and total payment
  order.tip = tipAmount;
  order.totalPayment = (
    parseFloat(order.totalPayment) + parseFloat(tipAmount)
  ).toFixed(2);

  // Update the payment intent with the new amount
  const newTotalAmount = Math.round(order.totalPayment * 100);
  const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
    amount_details: {
      tip: { newTotalAmount },
    },
  });

  if (!paymentIntent) {
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Failed to update payment intent",
    });
  }

  await order.save();

  res.status(200).json({
    success: true,
    status: 200,
    message: "Tip added and payment intent updated successfully",
    order,
    paymentIntent_Id: paymentIntent.id,
    paymentIntent_Tip: paymentIntent.amount_details,
  });
});

exports.getAllLists = Factory.getAll(List);
exports.updateList = Factory.updateOne(List);
exports.getOneList = Factory.getOne(List);
exports.deleteList = Factory.deleteOne(List);
exports.getOneOrder = Factory.getOne(Order);
