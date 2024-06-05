const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
  },
  { timestamps: true }
);
// favoriteSchema.pre([/^find/, "save"], function (next) {
//   this.populate({
//     path: "shop",
//   });
//   next();
// });
const Favorite = mongoose.model("Favorite", favoriteSchema);
module.exports = Favorite;
