// const mongoose = require("mongoose");
// const User = require("./userModel");

// const orderSchema = new mongoose.Schema(
//   {
//     orderNumber: {
//       type: String,
//       required: true,
//     },
//     orderStatus: {
//       type: String,
//       enum: ["pending", "ready for pickup", "delivered"],
//       default: "pending",
//     },
//     products: [
//       {
//         product: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "Product",
//           required: true,
//         },
//         shop: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "Shop",
//           required: true,
//         },
//         category: {
//           type: mongoose.Schema.Types.ObjectId,
//           required: true,
//         },
//         grocery: {
//           type: mongoose.Schema.Types.ObjectId,
//           required: true,
//         },
//         quantity: {
//           type: Number,
//           required: true,
//         },
//       },
//     ],
//     startLocation: {
//       type: { type: String, default: "Point" },
//       coordinates: { type: [Number], default: [0, 0] },
//     },
//     endtLocation: {
//       type: { type: String, default: "Point" },
//       coordinates: { type: [Number], default: [0, 0] },
//     },
//     status: {
//       type: String,
//       enum: ["accepted", "rejected", "pending"],
//       default: "pending",
//     },
//     customer: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     vendor: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },
//     driver: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },
//     deliveryCharges: {
//       type: String,
//     },
//   },
//   { timestamps: true }
// );

// const Order = mongoose.model("Order", orderSchema);
// module.exports = Order;
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
          required: true,
        },
        shop: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Shop",
          required: true,
        },
        category: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        grocery: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
      },
    ],
    startLocation: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    endLocation: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
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
    itemsTotal: {
      type: Number,
    },
    serviceFee: {
      type: Number,
      required: true,
    },
    adminFee: {
      type: Number,
      required: true,
    },
    totalPayment: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
