const mongoose = require("mongoose");

const grocerySchema = new mongoose.Schema({
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
  ],
  stockStatus: {
    type: String,
    enum: ["low stock", "available"],
    default: "available",
  },
});
grocerySchema.pre("save", async function (next) {
  this.stockStatus = this.quantity < 5 ? "low stock" : "available";
  next();
});
const categorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    required: true,
  },
  groceries: [grocerySchema],
});

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
    operatingHours: { type: String, default: "08:00 am-10:00 pm" },
    categories: [categorySchema],
  },
  { timestamps: true }
);

shopSchema.index({ location: "2dsphere" });

const Shop = mongoose.model("Shop", shopSchema);
module.exports = Shop;
