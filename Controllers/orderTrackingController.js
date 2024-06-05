const catchAsync = require("../Utils/catchAsync");
const OrderTracking = require("../Models/orderTrackingModel");

exports.getOrderTracking = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;

  const orderTracking = await OrderTracking.findOne({
    order: orderId,
  }).populate("order rider");

  res.status(200).json({
    success: true,
    data: orderTracking,
  });
});
