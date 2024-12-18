const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
        "accepted by owner",
        "accepted by rider",
        // "ready for pickup",
        // "rider accepted",
        "buying grocery",
        "ready to deliver",
        "on the way",
        "delivered",
        "completed",
        // "list order accepted",
      ],
      default: "pending",
    },
    orderType: {
      type: String,
      enum: ["simpleOrder", "listOrder"],
      default: "simpleOrder",
    },
    riderStatus: {
      type: String,
      enum: ["On the way", "Arrived"],
      default: "On the way",
    },
    rejectedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    listItems: [
      {
        productName: {
          type: String,
          // required: true,
        },
        quantity: {
          type: String,
          // required: true,
          min: 1,
        },
        price: {
          type: Number,
        },
        isAvailable: {
          type: Boolean,
          default: false,
        },
      },
    ],
    products: [
      {
        shop: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Shop",
          // required: true,
        },
        isOrderPickedUp: {
          type: Boolean,
          default: false,
        },
        shopTotal: {
          type: Number,
        },
        isOrderReadyForPickup: {
          type: Boolean,
          default: false,
        },
        category: {
          type: mongoose.Schema.Types.ObjectId,
          // required: true,
        },
        grocery: {
          type: mongoose.Schema.Types.ObjectId,
          // required: true,
        },
        quantity: {
          type: Number,
          // required: true,
        },
      },
    ],
    startLocation: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      address: String,
    },

    endLocation: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      address: String,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deliveryCharges: {
      type: Number,
    },
    deliveryPaymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
    },
    deliveryTime: {
      type: String,
    },
    isdeliveryInProgress: {
      type: Boolean,
      default: false,
    },
    itemsTotal: {
      type: String,
    },
    serviceFee: {
      type: Number,
      default: 2,
      // required: true,
    },
    adminFee: {
      type: Number,
      default: 1,
      // required: true,
    },
    tax: {
      type: Number,
      default: 2,
    },
    savings: {
      type: Number,
      default: 0,
    },
    totalPayment: {
      type: String,
      // required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
    },
    tip: {
      type: Number,
    },
    riderTotal: {
      type: Number,
    },
    shopEarnings: {
      type: Number,
    },
    shopAcceptedOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop",
      },
    ],
    shopRejectedOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop",
      },
    ],
    // shop: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Shop",
    // },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
