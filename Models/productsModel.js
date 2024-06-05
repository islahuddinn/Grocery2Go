const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    volume: {
      type: String,
    },
    manufacturedBy: {
      type: String,
    },
    quantity: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
    },
    images: [
      {
        type: String,
        default:
          "https://icon-library.com/images/default-profile-icon/default-profile-icon-6.jpg",
      },
    ],
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    // category: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Category",
    //   required: true,
    // },
    category: {
      type: String,
      enum: [
        "Fruits",
        "Vegitables",
        "Beverages",
        "Dairy",
        "Bakery",
        "Frozen Foods",
        "Meat",
        "Cleaners",
        "Paper Goods",
        "Personal Care",
        "Pharmacy",
      ],
      required: true,
    },
    favourite: {
      type: Boolean,
      default: false,
    },
    stockStatus: {
      type: String,
      enum: ["low stock", "available"],
      default: "available",
    },
  },
  { timestamps: true }
);

productSchema.pre("save", async function (next) {
  this.stockStatus = this.quantity < 5 ? "low stock" : "available";
  next();
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
