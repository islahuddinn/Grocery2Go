const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    shopTitle: {
      type: String,
      required: true,
      trim: true,
    },
    images: [
      {
        type: String,
        default:
          "https://icon-library.com/images/default-profile-icon/default-profile-icon-6.jpg",
      },
    ],
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true,
    },
    location: {
      type: {
        type: String,
        default: "Point",
      },
      coordinates: { type: [Number], default: [0, 0] },
    },
    operatingHours: { type: String, default: ["08:00 am-10:00 pm"] },
    // categories: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Category",
    //   },
    // ],
    category: [
      {
        type: String,
        required: true,
      },
    ],
    productName: {
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
    productImages: [
      {
        type: String,
        default:
          "https://icon-library.com/images/default-profile-icon/default-profile-icon-6.jpg",
      },
    ], //// Revamp the shop model to include groceries and categories.

    // category: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Category",
    //   required: true,
    // },

    // favourite: {
    //   type: Boolean,
    //   default: false,
    // },
    stockStatus: {
      type: String,
      enum: ["low stock", "available"],
      default: "available",
    },

    // products: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Product",
    //   },
    // ],
    // favourite: {
    //   type: Boolean,
    //   default: false,
    // },
  },
  { timestamps: true }
);

shopSchema.index({ location: "2dsphere" });

shopSchema.pre(/^find/, function (next) {
  this.populate({
    path: "products",
  });
  next();
});

const Shop = mongoose.model("Shop", shopSchema);
module.exports = Shop;
