const Earnings = require("../Models/earningsModel");
const User = require("../Models/userModel");
const Shop = require("../Models/shopsModel");
const CatchAsync = require("../Utils/catchAsync");
const Factory = require("../Controllers/handleFactory");
const AppError = require("../Utils/appError");

exports.getShopEarningsHistory = CatchAsync(async (req, res, next) => {
  const shopId = req.params.id;
  if (!shopId) {
    return next(new AppError("Shop ID is required", 400));
  }

  try {
    const shop = await Shop.findById(shopId).select(
      "ownerId shopTitle location"
    );

    if (!shop) {
      return next(new AppError("Shop not found", 404));
    }
    const earnings = await Earnings.find({ shop: shopId, type: "shop" })
      .populate({
        path: "order",
        select: "orderNumber paymentStatus totalAmount",
      })
      .exec();
    if (!earnings || earnings.length === 0) {
      return next(new AppError("No earnings found for this shop", 200));
    }

    const earningsDetails = earnings.map((earning) => ({
      earningId: earning._id,
      orderId: earning.order ? earning.order._id : null,
      orderNumber: earning.order ? earning.order.orderNumber : null,
      totalOrderValue: earning.order ? earning.order.totalAmount : null,
      paymentStatus: earning.order ? earning.order.paymentStatus : null,
      amountEarned: earning.amount,
      dateAndTime: earning.createdAt,
    }));

    res.status(200).json({
      success: true,
      status: 200,
      message: `Shop orders earnings fetched successfully.`,
      data: {
        shop: {
          shopId: shop._id,
          shopName: shop.shopTitle,
          shopLocation: shop.location,
        },
        // earningsDetails,
        earnings,
      },
    });
  } catch (error) {
    console.log(
      `Error fetching earnings for shop ID ${shopId}: ${error.message}`
    );
    return next(
      new AppError(`Failed to fetch earnings: ${error.message}`, 500)
    );
  }
});

exports.getAllShopEarnings = Factory.getAll(Earnings);
exports.getOneShopEarnings = Factory.getOne(Earnings);
exports.deleteShopEarnings = Factory.deleteOne(Earnings);

//////Rider earninigs history

exports.getRiderEarningsHistory = CatchAsync(async (req, res, next) => {
  const riderId = req.params.id;
  if (!riderId) {
    return next(new AppError("Rider ID is required", 400));
  }

  try {
    const riderEarnings = await Earnings.find({
      user: riderId,
      type: "rider",
    }).sort({ createdAt: -1 });

    if (riderEarnings.length === 0) {
      return res.status(200).json({
        success: true,
        status: 200,
        message: `No earnings found for rider ID: ${riderId}.`,
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      status: 200,
      message: `Earnings history fetched successfully.`,
      data: riderEarnings,
    });
  } catch (error) {
    return next(
      new AppError(
        `Failed to fetch rider earnings history: ${error.message}`,
        500
      )
    );
  }
});

exports.getAllRiderEarnings = Factory.getAll(Earnings);
exports.getOneRiderEarnings = Factory.getOne(Earnings);
exports.deleteRiderEarnings = Factory.deleteOne(Earnings);
