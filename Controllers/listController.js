const mongoose = require("mongoose");
const catchAsync = require("../Utils/catchAsync");
const AppError = require("../Utils/appError");
const List = require("../Models/listModel");
const Factory = require("../Controllers/handleFactory");
const User = require("../Models/userModel");
const Order = require("../Models/orderModel");
const { SendNotification } = require("../Utils/notificationSender");
const Notification = require("../Models/notificationModel");
const Shop = require("../Models/shopsModel");
const Earnings = require("../Models/earningsModel");
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

////// Get all riders

exports.getAllRiders = catchAsync(async (req, res, next) => {
  const riders = await User.find({ userType: "Rider" }).select(
    "-password -__v"
  ); // Exclude password and version key

  // Get ratings for each rider
  const riderRatingsPromises = riders.map(async (rider) => {
    const ratings = await Rating.find({ to: rider._id }).select(
      "stars comment createdAt -_id"
    );

    console.log(ratings, "Here are the ratings");

    // Calculate average rating
    const averageRating = ratings.length
      ? (
          ratings.reduce((acc, rating) => acc + rating.stars, 0) /
          ratings.length
        ).toFixed(2) // Ensures the average is a number and formatted to two decimals
      : "0";

    return {
      rider,
      ratings,
      averageRating: parseFloat(averageRating), // Convert to a number
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
  const notification = await Notification.create({
    sender: user._id,
    receiver: rider._id,
    data: `New delivery request from ${user.firstName}. Please accept or reject the request.`,
  });
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
    ////Notification
    const title = `Rider with id: ${newOrder.driver}, Accepted the order`;
    const body = `Rider with id: ${newOrder.driver} , Accepted the list order number: ${newOrder.orderNumber}`;

    await Notification.create({
      sender: req.user._id,
      receiver: customer._id,
      title: title,
      data: body,
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

// exports.verifyPaymentIntent = catchAsync(async (req, res, next) => {
//   const { paymentIntentId, orderId } = req.body;

//   // Validate input
//   if (!paymentIntentId) {
//     return next(new AppError("Payment Intent ID is required", 400));
//   }

//   try {
//     // Retrieve the PaymentIntent from Stripe
//     const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

//     // Check the payment status
//     if (paymentIntent.status !== "succeeded") {
//       return next(new AppError("Payment was not successful", 400));
//     }
//     const order = await Order.findById(orderId);
//     console.log(order, "here is the order ");
//     order.paymentStatus = "paid";

//     await order.save();

//     // Payment is successful, you can now process the order or other business logic
//     res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Payment verified successfully",
//       data: paymentIntent,
//     });
//   } catch (error) {
//     // Handle errors from Stripe or other issues
//     return next(
//       new AppError(`Payment verification failed: ${error.message}`, 500)
//     );
//   }
// });

exports.verifyPaymentIntent = async (req, res, next) => {
  const { paymentIntentId, orderId } = req.body;

  // Validate input
  if (!paymentIntentId) {
    // console.log("Payment Intent ID is missing.");
    return next(new AppError("Payment Intent ID is required", 400));
  }

  try {
    // Retrieve the PaymentIntent from Stripe
    // console.log(`Retrieving payment intent: ${paymentIntentId}`);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    /// Check the payment status
    if (paymentIntent.status !== "succeeded") {
      return next(new AppError("Payment was not successful", 400));
    }
    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return next(new AppError("Order not found", 404));
    }

    // Update the order's payment status to 'paid'
    order.paymentStatus = "paid";
    await order.save();

    // Initialize shop earnings map
    const shopEarningsMap = {};

    // Iterate over each product in the order
    for (const item of order.products) {
      const groceryId = new mongoose.Types.ObjectId(item.grocery);
      // console.log(`Searching for shop with grocery ID: ${groceryId}`);

      // Find the shop containing the grocery item
      const shop = await Shop.findOne({ "groceries._id": groceryId });
      if (!shop) {
        // console.log(`Shop not found for grocery ID: ${groceryId}`);
        return next(
          new AppError("Shop not found for the provided grocery ID", 404)
        );
      }

      // Find the grocery within the shop
      const grocery = shop.groceries.id(groceryId);
      if (!grocery) {
        // console.log(
        //   `Grocery not found for ID: ${groceryId} in shop ID: ${shop._id}`
        // );
        return next(new AppError("Grocery not found in shop", 404));
      }

      // Calculate earnings for each shop
      const productTotal = item.quantity * grocery.price;

      // Update shop earnings map
      if (!shopEarningsMap[shop._id]) {
        shopEarningsMap[shop._id] = {
          ownerId: shop.owner,
          total: 0,
        };
      }
      shopEarningsMap[shop._id].total += productTotal;

      console.log(
        `Shop ID: ${shop._id} - Total calculated: ${
          shopEarningsMap[shop._id].total
        }`
      );
    }

    // Process earnings for each shop
    const shopOrders = [];
    for (const shopId in shopEarningsMap) {
      const { ownerId, total } = shopEarningsMap[shopId];

      console.log(
        `Creating earnings record for shop ID: ${shopId} with total: ${total}`
      );

      // Create earnings record in the database
      const earnings = await Earnings.create({
        user: ownerId,
        shop: shopId,
        order: order._id,
        orderNumber: order.orderNumber,
        amount: total,
        type: "shop",
      });

      // Update the shop's total earnings
      await Shop.findByIdAndUpdate(shopId, { $inc: { shopEarnings: total } });

      // Log the creation of earnings
      console.log(`Earnings recorded: ${JSON.stringify(earnings)}`);

      // Add shop's earnings and total to the response array
      shopOrders.push({
        shop: shopId,
        totalEarnings: earnings.amount, // The recorded earnings amount
        totalOrderValue: total, // The total value of the shop's products in the order
      });
    }

    // Return response
    res.status(200).json({
      success: true,
      status: 200,
      message: "Payment verified and earnings recorded successfully",
      data: {
        paymentIntentId: paymentIntent.id,
        shopOrders,
      },
    });
  } catch (error) {
    // Handle errors from Stripe or other issues
    console.log(`Error during payment verification: ${error.message}`);
    return next(
      new AppError(`Payment verification failed: ${error.message}`, 500)
    );
  }
};

exports.verifyDeliveryPaymentIntent = catchAsync(async (req, res, next) => {
  const { paymentIntentId, orderId } = req.body;

  // Validate input
  if (!paymentIntentId) {
    return next(new AppError("Payment Intent ID is required", 400));
  }

  if (!orderId) {
    return next(new AppError("Order ID is required", 400));
  }

  try {
    // Retrieve the PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check the payment status
    if (paymentIntent.status !== "succeeded") {
      return next(new AppError("Payment was not successful", 400));
    }

    // Fetch the order by orderId
    const order = await Order.findById(orderId);
    if (!order) {
      return next(new AppError("Order not found", 404));
    }
    console.log(order, "here is the order ");

    // Update the delivery payment status
    order.deliveryPaymentStatus = "paid";
    await order.save();

    // Fetch the rider by the driver ID from the order
    const rider = await User.findById(order.driver);
    if (!rider) {
      return next(new AppError("Driver not found", 404));
    }
    console.log(rider, "Here is the driver");

    // Ensure riderEarnings is initialized and order.riderTotal is defined
    rider.riderEarnings = rider.riderEarnings || 0; // Ensure riderEarnings is initialized to 0 if undefined
    order.riderTotal = order.riderTotal || 0; // Ensure order.riderTotal is initialized to 0 if undefined
    rider.riderEarnings += order.riderTotal; // Update the rider earnings
    await rider.save();

    console.log(rider.riderEarnings, "here is the rider earnings");

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
  const deliveryChargesAmount = Math.round(deliveryCharges);
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
    order.riderTotal = total;

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
