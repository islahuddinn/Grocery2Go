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
  categoryImage: {
    type: String,
    default:
      "https://icon-library.com/images/default-profile-icon/default-profile-icon-6.jpg",
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
  isFavorite: {
    type: Boolean,
    default: false,
  },
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
    shopType: {
      type: String,
    },
    image: {
      type: String,
      default:
        "https://icon-library.com/images/default-profile-icon/default-profile-icon-6.jpg",
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isOrderAccepted: {
      type: Boolean,
      default: false,
    },
    isOrderRejected: {
      type: Boolean,
      default: false,
    },
    location: {
      type: {
        type: String,
        default: "Point",
      },
      coordinates: { type: [Number], default: [0.0, 0.0] },
      address: String,
    },
    operatingHours: { type: String, default: "08:00 am-10:00 pm" },
    bankAccountInfo: {
      bankName: {
        type: String,
      },
      bankAccountId: {
        type: String,
      },
      isOnboardingCompleted: {
        type: Boolean,
        default: false,
      },
    },
    shopEarnings: {
      type: Number,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    categories: {
      type: [categorySchema],
      default: [
        { categoryName: "Fruits", categoryImage: "image_url" },
        { categoryName: "Vegetables", categoryImage: "image_url" },
        { categoryName: "Beverages", categoryImage: "image_url" },
        { categoryName: "Dairy", categoryImage: "image_url" },
        { categoryName: "Backery", categoryImage: "image_url" },
        { categoryName: "Frozen foods", categoryImage: "image_url" },
        { categoryName: "Meat", categoryImage: "image_url" },
        { categoryName: "Cleaners", categoryImage: "image_url" },
        { categoryName: "Paper goods", categoryImage: "image_url" },
        { categoryName: "Personal Care", categoryImage: "image_url" },
        { categoryName: "Pharmacy", categoryImage: "image_url" },
      ],
    },
    groceries: [grocerySchema],
  },
  { timestamps: true }
);

shopSchema.index({
  // location: "2dsphere",
  shopTitle: "text",
  description: "text",
});
shopSchema.index({ location: "2dsphere" });

const Shop = mongoose.model("Shop", shopSchema);
module.exports = Shop;
