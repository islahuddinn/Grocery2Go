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
    listOrderNumber: {
      type: String,
    },
    orderType: {
      type: String,
      enum: ["listOrder"],
      default: "listOrder",
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
    isRejected: {
      type: Boolean,
      default: false,
    },
    isAccepted: {
      type: Boolean,
      default: false,
    },
    listStatus: {
      type: String,
      enum: ["pending", "accepted", "completed", "cancelled"],
    },
    riderRejectedList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    requestedRiders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    endLocation: {
      type: {
        type: String,
        default: "Point",
      },
      coordinates: { type: [Number], default: [0, 0] },
      address: String,
    },
  },
  { timestamps: true }
);

const List = mongoose.model("List", listSchema);

module.exports = List;
