const mongoose = require("mongoose");

const orderTrackingSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      required: true,
    },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    status: {
      type: String,
      enum: ["Picked Up", "In Transit", "Delivered"],
      default: "Picked Up",
    },
  },
  { timestamps: true }
);

orderTrackingSchema.index({ location: "2dsphere" });

const OrderTracking = mongoose.model("OrderTracking", orderTrackingSchema);
module.exports = OrderTracking;
