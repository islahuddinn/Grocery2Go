const Rating = require("../Models/ratingModel.js");
const catchAsync = require("../Utils/catchAsync.js");
const AppError = require("../Utils/appError.js");
// const User = require("../Models/userModel.js");
// const Message = require("../Models/message.js");
// const RideRequest = require("../Models/rideRequestModel.js");

exports.createRating = catchAsync(async (req, res, next) => {
  const { from, to, stars, requestId, toDriver } = req.body;

  if (!from || !to || stars == null || !requestId) {
    return next(new AppError("Invalid input", 400));
  }

  const newRating = await Rating.create({
    from,
    to,
    stars,
    requestId,
    toDriver,
    createdAt: Date.now(),
  });

  res.status(201).json({
    success: true,
    status: 201,
    message: "Rating created successfully",
    data: newRating,
  });
});

////----update rating -----////
exports.updateRating = catchAsync(async (req, res, next) => {
  const { ratingId, stars } = req.body;

  if (!ratingId || stars == null) {
    return next(new AppError("Invalid input", 400));
  }

  const updatedRating = await Rating.findByIdAndUpdate(
    ratingId,
    { stars },
    { new: true, runValidators: true }
  );

  if (!updatedRating) {
    return next(new AppError("Rating not found", 404));
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Rating updated successfully",
    data: updatedRating,
  });
});

/////-----Get rating for user -----//////
exports.getRatingsForUser = catchAsync(async (req, res, next) => {
  const userId = req.params.id;

  if (!userId) {
    return next(new AppError("Invalid input", 400));
  }

  const ratings = await Rating.find({ to: userId });

  res.status(200).json({
    success: true,
    status: 200,
    message: "Ratings retrieved successfully",
    data: ratings,
  });
});
///////------Get average rating for user ---- /////
exports.getAverageRatingForUser = catchAsync(async (req, res, next) => {
  const userId = req.params.id;
  console.log(userId, "here is the user id");

  if (!userId) {
    return next(new AppError("Invalid input", 400));
  }

  const ratings = await Rating.find({ to: userId });
  if (ratings.length === 0) {
    return res.status(200).json({
      success: true,
      status: 200,
      message: "No ratings found for this user",
      averageRating: 0,
    });
  }

  const totalStars = ratings.reduce((acc, rating) => acc + rating.stars, 0);
  const averageRating = totalStars / ratings.length;

  res.status(200).json({
    success: true,
    status: 200,
    message: "Average rating retrieved successfully",
    averageRating: averageRating.toFixed(2),
  });
});
///////-------Delete Rating ----- //////
exports.deleteRating = catchAsync(async (req, res, next) => {
  const { ratingId } = req.params;

  if (!ratingId) {
    return next(new AppError("Invalid input data", 400));
  }

  const deletedRating = await Rating.findByIdAndDelete(ratingId);

  if (!deletedRating) {
    return next(new AppError("Rating not found", 404));
  }

  res.status(204).json({
    success: true,
    status: 204,
    message: "Rating deleted successfully",
  });
});

// const TxDeleter = require("../txDeleter");
// const {
//   Query,
//   QueryModel,
//   QueryBuilder,

//   Matcher,
//   Eq,

//   PostProcessor,
// } = require("../Utils/query");
// const catchAsync = require("../Utils/catchAsync");

// exports.find = catchAsync(async (req, res, next) => {
//   const ratings = await Ratings.find({});

//   res.status(200).json({
//     status: 200,
//     success: true,
//     message: "",
//     data: { ratings },
//   });
// });

// exports.index = catchAsync(async (req, res, next) => {
//   const ratings = await Ratings.find({ to: req.user._id }).populate("from");
//   const rides = await RideRequest.find({
//     acceptedBy: req.user._id,
//     status: "completed",
//   });
//   const totalRides = rides.length;
//   res.status(200).json({
//     status: 200,
//     success: true,
//     message: "",
//     data: {
//       ratings,
//       totalRides,
//       averageRating: req.user.averageRating,
//       totalReviews: req.user.totalReviews,
//     },
//   });
// });

// exports.store = catchAsync(async (req, res, next) => {
//   const { to, from, requestId } = req.body;
//   const rated = await Ratings.findOne({ from, to, requestId });

//   const rating = await Ratings.findOneAndUpdate(
//     { from, to, requestId },
//     req.body,
//     { upsert: true }
//   );
//   const toUser = await User.findById(to);
//   const totalRatings = toUser.totalReviews;
//   console.log("total ratings", totalRatings);
//   const oldRating = toUser.averageRating;
//   console.log("old rating", oldRating);
//   const a = oldRating * totalRatings + req.body.stars;
//   console.log("aaaa", a);
//   const b = totalRatings + 1;
//   console.log("bbbb", b);

//   const newAverage = a / b;
//   console.log("newwwww", newAverage);

//   await User.findByIdAndUpdate(to, {
//     totalReviews: totalRatings + 1,
//     averageRating: newAverage,
//   });
//   const result = await Message.deleteMany({
//     $or: [
//       { sender: to, receiver: from },
//       { sender: from, receiver: to },
//     ],
//   });
//   console.log(result);
//   res.status(200).json({
//     status: 200,
//     success: true,
//     message: "Rating Created Successfully",
//     data: { rating },
//   });
// });

// exports.update = catchAsync(async (req, res, next) => {
//   const ratings = await Ratings.findByIdAndUpdate(
//     req.params.id,
//     { $set: JSON.parse(JSON.stringify(req.body)) },
//     { new: true }
//   );

//   res.status(200).json({
//     status: 200,
//     success: true,
//     message: "Ratings Edited",
//     data: { ratings },
//   });
// });

// exports.delete = catchAsync(async (req, res, next) => {
//   let ratings = await Ratings.findOne(
//     req.params.id
//       ? { _id: req.params.id }
//       : JSON.parse(decodeURIComponent(req.query))
//   );
//   ratings = await TxDeleter.deleteOne("Ratings", req.params.id);

//   res.status(200).json({
//     status: 200,
//     success: true,
//     message: "Ratings Deleted",
//     data: { ratings },
//   });
// });
