const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        quantity: Number,
        volume: String,
      },
    ],
    adminFeePercentage: {
      type: Number,
      default: 0.05,
    },
    riderFeePerKm: {
      type: Number,
      default: 1,
    },
    averageSpeedKmPerHour: {
      type: Number,
      default: 30,
    },
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
