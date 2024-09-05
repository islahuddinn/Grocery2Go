const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    toDriver: {
      type: String,
      default: false,
    },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "OrderRequest" },
    comment: String,
    stars: Number,
    createdAt: Number,
  },
  { timestamps: true }
);

ratingSchema.pre(/^find/, function (next) {
  this.populate({
    path: "from",
    select: "firstName lastName image",
  });
  next();
});
const Rating = mongoose.model("Rating", ratingSchema);

module.exports = Rating;
