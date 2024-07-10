const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    enum: [
      "Fruits",
      "Vegetables",
      "Beverages",
      "Dairy",
      "Backery",
      "Frozen foods",
      "Meat",
      "Cleaners",
      "Paper goods",
      "Personal Care",
      "Pharmacy",
    ],
    required: [true, "Enter a valid categoryName (Fruits, Vegetables etc)"],
  },
});

const grocerySchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  categoryName: [categorySchema],
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
      required: true,
    },
    location: {
      type: {
        type: String,
        default: "Point",
      },
      coordinates: { type: [Number], default: [0, 0] },
      address: String,
    },
    operatingHours: { type: String, default: "08:00 am-10:00 pm" },
    categories: {
      type: [categorySchema],
      default: [
        { categoryName: "Fruits" },
        { categoryName: "Vegetables" },
        { categoryName: "Beverages" },
        { categoryName: "Dairy" },
        { categoryName: "Backery" },
        { categoryName: "Frozen foods" },
        { categoryName: "Meat" },
        { categoryName: "Cleaners" },
        { categoryName: "Paper goods" },
        { categoryName: "Personal Care" },
        { categoryName: "Pharmacy" },
      ],
    },
    groceries: [grocerySchema],
  },
  { timestamps: true }
);

shopSchema.index({ location: "2dsphere" });

const Shop = mongoose.model("Shop", shopSchema);
module.exports = Shop;
