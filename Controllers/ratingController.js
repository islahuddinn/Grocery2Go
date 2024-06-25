const Ratings = require("../Models/ratingModel.js");
const User = require("../Models/userModel.js");
const Message = require("../Models/message.js ");
const RideRequest = require("../Models/rideRequestModel.js");

const TxDeleter = require("../txDeleter");
const {
  Query,
  QueryModel,
  QueryBuilder,

  Matcher,
  Eq,

  PostProcessor,
} = require("../Utils/query");
const catchAsync = require("../Utils/catchAsync");

exports.find = catchAsync(async (req, res, next) => {
  const ratings = await Ratings.find({});

  res.status(200).json({
    status: 200,
    success: true,
    message: "",
    data: { ratings },
  });
});

exports.index = catchAsync(async (req, res, next) => {
  const ratings = await Ratings.find({ to: req.user._id }).populate("from");
  const rides = await RideRequest.find({
    acceptedBy: req.user._id,
    status: "completed",
  });
  const totalRides = rides.length;
  res.status(200).json({
    status: 200,
    success: true,
    message: "",
    data: {
      ratings,
      totalRides,
      averageRating: req.user.averageRating,
      totalReviews: req.user.totalReviews,
    },
  });
});

exports.store = catchAsync(async (req, res, next) => {
  const { to, from, requestId } = req.body;
  const rated = await Ratings.findOne({ from, to, requestId });

  const rating = await Ratings.findOneAndUpdate(
    { from, to, requestId },
    req.body,
    { upsert: true }
  );
  const toUser = await User.findById(to);
  const totalRatings = toUser.totalReviews;
  console.log("total ratings", totalRatings);
  const oldRating = toUser.averageRating;
  console.log("old rating", oldRating);
  const a = oldRating * totalRatings + req.body.stars;
  console.log("aaaa", a);
  const b = totalRatings + 1;
  console.log("bbbb", b);

  const newAverage = a / b;
  console.log("newwwww", newAverage);

  await User.findByIdAndUpdate(to, {
    totalReviews: totalRatings + 1,
    averageRating: newAverage,
  });
  const result = await Message.deleteMany({
    $or: [
      { sender: to, receiver: from },
      { sender: from, receiver: to },
    ],
  });
  console.log(result);
  res.status(200).json({
    status: 200,
    success: true,
    message: "Rating Created Successfully",
    data: { rating },
  });
});

exports.update = catchAsync(async (req, res, next) => {
  const ratings = await Ratings.findByIdAndUpdate(
    req.params.id,
    { $set: JSON.parse(JSON.stringify(req.body)) },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Ratings Edited",
    data: { ratings },
  });
});

exports.delete = catchAsync(async (req, res, next) => {
  let ratings = await Ratings.findOne(
    req.params.id
      ? { _id: req.params.id }
      : JSON.parse(decodeURIComponent(req.query))
  );
  ratings = await TxDeleter.deleteOne("Ratings", req.params.id);

  res.status(200).json({
    status: 200,
    success: true,
    message: "Ratings Deleted",
    data: { ratings },
  });
});
