const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
    },
    orderStatus: {
      type: String,
      enum: ["pending", "ready for pickup", "delivered"],
      default: "pending",
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        quantity: {
          type: Number,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["accepted", "rejected", "pending"],
      default: "pending",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
