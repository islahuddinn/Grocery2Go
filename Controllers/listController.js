const catchAsync = require("../Utils/catchAsync");
const List = require("../Models/listModel");
const Factory = require("../Controllers/handleFactory");
const User = require("../Models/userModel");
const Order = require("../Models/orderModel");
const SendNotification = require("../Utils/notificationSender");
const Notification = require("../Models/notificationModel");
const Shop = require("../Models/shopsModel");

exports.addProductsToList = catchAsync(async (req, res, next) => {
  const { items } = req.body;
  const newList = await List.create({
    user: req.user.id,
    items: items,
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

// // Select rider

// exports.requestRider = catchAsync(async (req, res, next) => {
//   const { deliveryLocation, riderId, listId } = req.body;
//   const { user } = req;

//   // Validate that the rider exists
//   const rider = await User.findOne({ _id: riderId, userType: "Rider" });
//   if (!rider) {
//     return res.status(404).json({
//       success: false,
//       status: 404,
//       message: "Rider not found",
//     });
//   }

//   // Retrieve the list by listId
//   const list = await List.findById(listId).populate("user").populate("items");
//   if (!list) {
//     return res.status(404).json({
//       success: false,
//       status: 404,
//       message: "List not found",
//     });
//   }

//   // Generate a unique order number (e.g., using a timestamp)
//   const orderNumber = `ORD-${Date.now()}`;
//   //// get the item price from shop by item name
//   const price = await Shop.find();
//   // Calculate items total
//   const itemsTotal = list.items.reduce(
//     (acc, item) => acc + item.quantity * item.price,
//     0
//   );
//   console.log(itemsTotal, "you got the price");
//   // Create the order
//   const newOrder = await Order.create({
//     orderNumber,
//     customer: list.user._id,
//     products: list.items.map((item) => ({
//       productName: item.productName,
//       quantity: item.quantity,
//       price: item.price, // Assuming you have the price in your item schema
//     })),
//     startLocation: "Shop Location", // Modify this as needed
//     endLocation: deliveryLocation,
//     itemsTotal,
//     serviceFee: 0.5, // Example service fee
//     adminFee: 0.1, // Example admin fee
//     totalPayment: itemsTotal + 0.5 + 0.1 + 2, // itemsTotal + serviceFee + adminFee + deliveryCharges
//     deliveryCharges: 2.0, // Example delivery charge
//   });

//   // Create a notification for the rider
//   // const notification = await Notification.create({
//   //   message: `New order from ${user.firstName}. Please accept or reject the order.`,
//   //   sender: user._id,
//   //   receiver: rider._id,
//   // });

//   // Send the notification to the rider
//   await SendNotification({
//     token: rider.deviceToken, // Assuming the rider has a deviceToken field
//     title: `New Order from ${user.firstName}`,
//     message: "Please accept or reject the order.",
//   });

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
//       products: newOrder.products,
//     },
//   });
// });

exports.requestRider = catchAsync(async (req, res, next) => {
  const { deliveryLocation, riderId, listId } = req.body;
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
  const list = await List.findById(listId).populate("user").populate("items");
  if (!list) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "List not found",
    });
  }

  // Function to get item price from the shop by product name
  const getItemPrice = async (productName) => {
    const shop = await Shop.findOne({
      "categories.groceries.productName": productName,
    });
    if (shop) {
      for (const category of shop.categories) {
        for (const grocery of category.groceries) {
          if (grocery.productName === productName) {
            return grocery.price;
          }
        }
      }
    }
    return null;
  };

  // Generate a unique order number (e.g., using a timestamp)
  const orderNumber = `ORD-${Date.now()}`;

  // Calculate items total and construct products array
  const products = [];
  let itemsTotal = 0;

  for (const item of list.items) {
    const price = await getItemPrice(item.productName);
    if (price !== null) {
      const totalPrice = item.quantity * price;
      itemsTotal += totalPrice;
      products.push({
        productName: item.productName,
        quantity: item.quantity,
        price: price,
      });
    } else {
      return res.status(404).json({
        success: false,
        status: 404,
        message: `Price not found for item: ${item.productName}`,
      });
    }
  }

  // Create the order
  const newOrder = await Order.create({
    orderNumber,
    customer: list.user._id,
    products,
    startLocation: "Shop Location", // Modify this as needed
    endLocation: deliveryLocation,
    itemsTotal,
    serviceFee: 0.5, // Example service fee
    adminFee: 0.1, // Example admin fee
    totalPayment: itemsTotal + 0.5 + 0.1 + 2, // itemsTotal + serviceFee + adminFee + deliveryCharges
    deliveryCharges: 2.0, // Example delivery charge
  });

  // Create a notification for the rider
  await Notification.create({
    message: `New order from ${user.firstName}. Please accept or reject the order.`,
    sender: user._id,
    receiver: rider._id,
  });

  // Send the notification to the rider
  await SendNotification({
    token: rider.deviceToken, // Assuming the rider has a deviceToken field
    title: `New Order from ${user.firstName}`,
    message: "Please accept or reject the order.",
  });

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
      products: newOrder.products,
    },
  });
});

exports.updateList = Factory.updateOne(List);
exports.getOneList = Factory.getOne(List);
exports.deleteList = Factory.deleteOne(List);
