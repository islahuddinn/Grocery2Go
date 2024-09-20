const mongoose = require("mongoose");
const User = require("../Models/userModel");
const catchAsync = require("../Utils/catchAsync");
const AppError = require("../Utils/appError");
const Order = require("../Models/orderModel");
const Shop = require("../Models/shopsModel");

exports.updateRiderOnlineStatus = catchAsync(async (req, res, next) => {
  const { riderId, isOnline } = req.body;

  if (!riderId || typeof isOnline !== "boolean") {
    return next(new AppError("No User Found With Given Id ", 404));
  }

  const rider = await User.findOne({ _id: riderId, userType: "Rider" });
  if (!rider) {
    return next(new AppError("No User Found With Given Id ", 404));
  }

  rider.isOnline = isOnline;
  await rider.save();

  res.status(200).json({
    success: true,
    status: 200,
    message: `Rider marked as ${
      isOnline ? "isOnline (online)" : "inactive (offline)"
    } successfully`,
    data: {
      riderId: rider._id,
      isActive: rider.isOnline,
    },
  });
});

//////-----Rider stats------/////
// exports.getRiderStatistics = catchAsync(async (req, res, next) => {
//   const { riderId } = req.params;

//   if (!riderId) {
//     return res.status(400).json({
//       success: false,
//       status: 400,
//       message: "Invalid rider ID",
//     });
//   }

//   const completedOrders = await Order.find({
//     driver: riderId,
//     orderStatus: "delivered",
//   }).countDocuments();

//   const inProgressOrders = await Order.find({
//     driver: riderId,
//     orderStatus: { $nin: ["delivered", "pending"] },
//   }).countDocuments();

//   const totalEarnings = await Order.aggregate([
//     {
//       $match: {
//         driver: mongoose.Types.ObjectId(riderId),
//         orderStatus: "delivered",
//       },
//     },
//     { $group: { _id: null, total: { $sum: "$totalPayment" } } },
//   ]);

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Rider statistics retrieved successfully",
//     data: {
//       completedOrders,
//       inProgressOrders,
//       totalEarnings: totalEarnings[0] ? totalEarnings[0].total : 0,
//     },
//   });
// });

exports.getRiderStatistics = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  console.log(userId, "here is the  rider id");

  // if (!userId) {
  //   return next(new AppError("No Rider Found With Given Id ", 404));
  // }
  const rider = await User.findById(userId);

  if (!rider) {
    return next(new AppError("No Rider Found With Given Id", 404));
  }

  // Fetch completed orders (assuming "delivered" status means completed)
  const completedOrders = await Order.find({
    driver: userId,
    orderStatus: "completed",
  }).countDocuments();

  // Fetch in-progress orders (assuming statuses other than "delivered" and "pending" mean in-progress)
  const inProgressOrders = await Order.find({
    driver: userId,
    orderStatus: { $nin: ["completed", "pending"] },
  }).countDocuments();

  // Calculate total earnings based on the riderEarnings field
  const totalEarnings = await User.aggregate([
    {
      $match: {
        driver: new mongoose.Types.ObjectId(userId),
        orderStatus: "completed",
      },
    },
    { $group: { _id: null, total: { $sum: "$riderEarnings" } } },
  ]);

  const riderEarnings = rider.riderEarnings || 0;

  res.status(200).json({
    success: true,
    status: 200,
    message: "Rider statistics retrieved successfully",
    data: {
      completedOrders,
      inProgressOrders,
      // totalEarnings: totalEarnings[0] ? totalEarnings[0].total : 0,
      totalEarnings: riderEarnings,
    },
  });
});

//////------ Search shops, or any grocery store function------/////

// exports.searchShopByTitle = catchAsync(async (req, res, next) => {
//   const { keywords } = req.query;

//   if (!keywords) {
//     return next(new AppError("No Search keyword provided. ", 400));
//   }

//   const regex = new RegExp(keywords, "i");

//   const shops = await Shop.find({ shopTitle: regex });

//   if (!shops.length) {
//     return next(
//       new AppError("No shops found matching the provided keywords", 404)
//     );
//   }
//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Shops retrieved successfully",
//     data: shops,
//   });
// });
exports.searchShopByTitle = catchAsync(async (req, res, next) => {
  const { keywords } = req.query;

  if (!keywords) {
    return next(new AppError("Search keywords are required", 400));
  }

  // Split keywords by spaces
  const keywordArray = keywords.split(" ");
  const totalKeywords = keywordArray.length;

  // Find FAQs where at least 60% of the keywords match the question
  const shops = await Shop.find({});

  const matchingFAQs = shops.filter((faq) => {
    const questionWords = faq.shopTitle.split(" ");
    const matchingWords = keywordArray.filter((keyword) =>
      questionWords.some((word) =>
        word.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    // Return only FAQs where at least 60% of keywords match
    return matchingWords.length / totalKeywords >= 0.6;
  });

  if (!matchingFAQs.length) {
    return next(
      new AppError("No shops found matching the search criteria", 200)
    );
  }

  res.status(200).json({
    success: true,
    status: 200,
    data: {
      shops: matchingFAQs,
    },
  });
});

/////----get all online riders------////

exports.getAllOnlineRiders = catchAsync(async (req, res, next) => {
  const onlineRiders = await User.find({ userType: "Rider", isOnline: true });

  if (!onlineRiders.length) {
    return next(new AppError("No online rider found", 404));
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Online riders retrieved successfully",
    data: onlineRiders,
  });
});

/////-----Navigte Rider------///
exports.updateLocation = async (req, res, next) => {
  console.log("Update my location hitt>> ", req.body, req.user);

  const users = await User.findByIdAndUpdate(req.body.user._id, {
    location: req.body.location,
  });

  res
    .to(req.body.user._id.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "updated",
      data: { location: req.body.location },
    });
  if (req.body.to) {
    res
      .to(req.body.to.toString())
      .status(200)
      .json({
        status: 200,
        success: true,
        message: "updated",
        data: { location: req.body.location },
      });
  }
};

///// GET ALL COMPLETED ORDERS BY RIDER
exports.getCompletedOrdersByRider = catchAsync(async (req, res, next) => {
  const riderId = req.params.id; // Get the riderId from request parameters

  // Find the rider by ID to ensure it exists
  const rider = await User.findById(riderId);
  if (!rider) {
    return next(new AppError("Rider not found", 404));
  }

  // Find all orders that are marked as 'completed' and include the provided riderId as the driver
  const completedOrders = await Order.find({
    orderStatus: "completed", // Filter orders by 'completed' status
    driver: riderId, // Filter orders where the rider is assigned as the driver
  })
    .populate("products.shop", "shopTitle image location owner") // Populate shop details
    .populate("customer", "firstName lastName email image location") // Populate customer details
    .populate("driver", "firstName lastName email image location") // Populate driver (rider) details
    .select("-__v"); // Exclude internal versioning field

  // Map the completed orders to the required format
  const formattedOrders = completedOrders.map((order) => ({
    orderNumber: order.orderNumber,
    riderStatus: order.riderStatus,
    orderType: order.orderType,
    totalListItems: order.totalListItems,
    _id: order._id,
    customer: order.customer
      ? {
          location: order.customer.location,
          _id: order.customer._id,
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          email: order.customer.email,
          image: order.customer.image,
          id: order.customer._id.toString(),
        }
      : {}, // Handle case where customer is undefined
    shopDetailWithProduct: Array.isArray(order.products)
      ? order.products.map((product) => ({
          shopId: product?.shop?._id?.toString() || "",
          ownerId: product?.shop?.owner?.toString() || "",
          shopTitle: product?.shop?.shopTitle || "",
          image: product?.shop?.image || "",
          location: product?.shop?.location || {},
          isOrderAccepted: product?.isOrderAccepted || false,
          isOrderPickedUp: product?.isOrderPickedUp || false,
          isOrderReadyForPickup: product?.isOrderReadyForPickup || false,
          products: Array.isArray(product?.products)
            ? product.products.map((prod) => ({
                productName: prod.productName,
                category: Array.isArray(prod?.category)
                  ? prod.category.map((cat) => ({
                      categoryName: cat.categoryName,
                      categoryImage: cat.categoryImage,
                      _id: cat._id,
                    }))
                  : [], // Handle case where category is undefined
                volume: prod.volume,
                quantity: prod.quantity,
                productImages: prod.productImages || [],
                price: prod.price,
              }))
            : [], // Handle case where products are undefined
          shopTotal: product?.shopTotal || 0,
        }))
      : [], // Handle case where order.products is undefined
    orderTotal: order.orderTotal,
    rider: order.driver
      ? {
          location: order.driver.location,
          _id: order.driver._id,
          firstName: order.driver.firstName,
          lastName: order.driver.lastName,
          email: order.driver.email,
          image: order.driver.image,
          id: order.driver._id.toString(),
        }
      : {}, // Handle case where driver is undefined
    orderStatus: order.orderStatus,
    orderSummary: {
      itemsTotal: order.itemsTotal,
      totalListItems: order.listItems ? order.listItems.length : 0,
      listItems: order.listItems ? order.listItems : [],
      serviceFee: order.serviceFee,
      adminFee: order.adminFee,
      totalPayment: order.totalPayment,
      paymentStatus: order.paymentStatus,
      deliveryFee: order.deliveryCharges,
      deliveryTime: order.deliveryTime,
      startLocation: order.startLocation,
      endLocation: order.endLocation,
      deliveryPaymentStatus: order.deliveryPaymentStatus,
      shopAcceptedOrder: order.shopAcceptedOrder,
      shopRejectedOrder: order.shopRejectedOrder,
    },
  }));

  // Return a success response with all formatted orders
  res.status(200).json({
    success: true,
    status: 200,
    results: formattedOrders.length,
    message: "Completed orders retrieved successfully",
    orders: formattedOrders,
  });
});
