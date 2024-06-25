const mongoose = require("mongoose");

const structure = {
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  toDriver: {
    type: String,
    default: false,
  },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: "OrderRequest" },

  stars: Number,
  createdAt: Number,
};

const schema = new mongoose.Schema(structure);
const model = mongoose.model("Ratings", schema);

module.exports = model;
