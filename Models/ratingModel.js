const mongoose = require("mongoose");
const TxQuery = require("../txQuery");

const structure = {
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  toDriver: {
    type: String,
    default: false,
  },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: "RideRequest" },

  stars: Number,
  createdAt: Number,
};

const schema = new mongoose.Schema(structure);
const model = mongoose.model("Ratings", schema);
TxQuery.model("Ratings", model, structure);

module.exports = model;
