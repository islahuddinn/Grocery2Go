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

  if (!userId) {
    return next(new AppError("No Rider Found With Given Id ", 404));
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
  const totalEarnings = await Order.aggregate([
    {
      $match: {
        driver: new mongoose.Types.ObjectId(userId),
        orderStatus: "completed",
      },
    },
    { $group: { _id: null, total: { $sum: "$riderEarnings" } } },
  ]);

  res.status(200).json({
    success: true,
    status: 200,
    message: "Rider statistics retrieved successfully",
    data: {
      completedOrders,
      inProgressOrders,
      totalEarnings: totalEarnings[0] ? totalEarnings[0].total : 0,
    },
  });
});

//////------ Search shops, or any grocery store function------/////

exports.searchShopByTitle = catchAsync(async (req, res, next) => {
  const { keywords } = req.query;

  if (!keywords) {
    return next(new AppError("No Search keyword provided. ", 400));
  }

  const regex = new RegExp(keywords, "i");

  const shops = await Shop.find({ shopTitle: regex });

  if (!shops.length) {
    return next(
      new AppError("No shops found matching the provided keywords", 404)
    );
  }
  res.status(200).json({
    success: true,
    status: 200,
    message: "Shops retrieved successfully",
    data: shops,
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
