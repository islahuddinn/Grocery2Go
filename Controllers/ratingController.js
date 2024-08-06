const Rating = require("../Models/ratingModel.js");
const catchAsync = require("../Utils/catchAsync.js");
const AppError = require("../Utils/appError.js");
// const User = require("../Models/userModel.js");
// const Message = require("../Models/message.js");
// const RideRequest = require("../Models/rideRequestModel.js");

exports.createRating = catchAsync(async (req, res, next) => {
  const { from, to, stars, toDriver } = req.body;

  if (!from || !to || stars == null || !toDriver) {
    return next(new AppError("Invalid input", 400));
  }

  const newRating = await Rating.create({
    from,
    to,
    stars,
    // requestId,
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
  const ratingId = req.params.id;

  if (!ratingId) {
    return next(new AppError("Invalid input data", 400));
  }

  const deletedRating = await Rating.findByIdAndDelete(ratingId);

  if (!deletedRating) {
    return next(new AppError("Rating not found", 200));
  }

  res.status(204).json({
    success: true,
    status: 204,
    message: "Rating deleted successfully",
  });
});
