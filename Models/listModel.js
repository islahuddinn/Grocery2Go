const mongoose = require("mongoose");

const listSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      // required: true,
    },
    listTitle: {
      type: String,
      // required: true,
    },
    items: [
      {
        productName: {
          type: String,
          required: true,
        },
        quantity: {
          type: String,
          required: true,
          min: 1,
        },
        isAvailable: {
          type: Boolean,
          default: false,
        },
      },
    ],
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    listStatus: {
      enum: ["pending", "accepted", "completed", "cancelled"],
    },
  },
  { timestamps: true }
);

const List = mongoose.model("List", listSchema);

module.exports = List;
