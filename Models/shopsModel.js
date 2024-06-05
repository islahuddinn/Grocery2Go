const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    name: {
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
    // categories: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Category",
    //   },
    // ],

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    favourite: {
      type: Boolean,
      default: false,
    },
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
