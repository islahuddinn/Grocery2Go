const mongoose = require("mongoose");

const structure = {
  rideType: { type: String, default: "Bike" },
  startLocation: {
    type: { type: String, default: "point" },
    coordinates: [Number],
    address: String,
    description: String,
  },
  endLocation: {
    type: { type: String, default: "point" },
    coordinates: [Number],
    address: String,
    description: String,
  },
  driverLocation: {
    type: { type: String, default: "point" },
    coordinates: [Number],
    address: String,
    description: String,
  },
  reasonOfCancellation: String,
  fare: Number,
  distance: Number,
  travelTime: String,
  tip: Number,
  payed: { type: Boolean, default: false },
  status: { type: String, default: "pending" },
  started: { type: Boolean, default: false },
  arrived: { type: Boolean, default: false },
  // rideEnd: { type: Boolean, default: false },
  isDeliverd: { type: Boolean, default: false },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  canceledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: Number,
};

const schema = new mongoose.Schema(structure);
const model = mongoose.model("OrderDeliveryRequest", schema);

module.exports = model;
