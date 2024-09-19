const mongoose = require("mongoose");
const earningsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  orderNumber: String,
  amount: { type: Number, required: true },
  type: { type: String, enum: ["shop", "rider"], required: true },
  createdAt: { type: Date, default: Date.now },
});

const Earnings = mongoose.model("Earnings", earningsSchema);

module.exports = Earnings;
