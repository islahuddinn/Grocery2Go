const Shop = require("../Models/shopsModel");
const Product = require("../Models/productsModel");
const AppError = require("../Utils/appError");
const catchAsync = require("../Utils/catchAsync");
const factory = require("./handleFactory");
const User = require("../Models/userModel");
const Favorite = require("../Models/favoriteModel");

///////------Shops Controllers-----//////

exports.createShop = catchAsync(async (req, res, next) => {
  const { name, images, location, categories } = req.body;

  // Check if owner exists
  // const ownerExists = await User.findById(req.user);
  // if (!ownerExists) {
  //   return res.status(400).json({
  //     success: false,
  //     status: 400,
  //     message: "Owner not found",
  //   });
  // }

  // Create new shop
  const newShop = await Shop.create({
    name,
    images,
    location,
    categories,
  });

  // Populate categories
  await newShop.save();

  res.status(201).json({
    success: true,
    status: 201,
    message: "Shop created successfully",
    data: newShop,
  });
});

// exports.addShop = factory.creatOne(Shop);
exports.updateShop = factory.updateOne(Shop);
exports.getShop = factory.getOne(Shop);
exports.getAllShop = factory.getAll(Shop);
exports.deleteShop = factory.deleteOne(Shop);
//////---- Mark a shop as favorite----////

exports.toggleShopFavorite = catchAsync(async (req, res, next) => {
  const { shopId } = req.body;
  const userId = req.user.id;

  // Check if the shop is already marked as favorite
  const favorite = await Favorite.findOne({ user: userId, shop: shopId });

  if (favorite) {
    // Unmark as favorite
    await Favorite.findOneAndDelete({ user: userId, shop: shopId });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Shop unmarked as favorite",
    });
  } else {
    // Mark as favorite
    const newFavorite = await Favorite.create({ user: userId, shop: shopId });

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Shop marked as favorite",
      data: newFavorite,
    });
  }
});

///////// Get all favorite shops for a user
exports.getAllFavoriteShops = catchAsync(async (req, res, next) => {
  const favorites = await Favorite.find({
    user: req.user.id,
    shop: { $exists: true },
  }).populate({
    path: "shop",
    select: "name location images owner products",
  });

  res.status(200).json({
    success: true,
    data: favorites.map((fav) => fav.shop).filter((shop) => shop !== null),
  });
});

///////------Shops Product Controllers-----/////

exports.addProduct = factory.creatOne(Product);
exports.updateProduct = factory.updateOne(Product);
exports.getOneProduct = factory.getOne(Product);
exports.getAllProduct = factory.getAll(Product);
exports.deleteProduct = factory.deleteOne(Product);

// Mark a product as favorite
// Toggle favorite status for a product
exports.toggleProductFavorite = catchAsync(async (req, res, next) => {
  const { productId } = req.body;
  const userId = req.user.id;

  // Check if the product is already marked as favorite
  const favorite = await Favorite.findOne({ user: userId, product: productId });

  if (favorite) {
    // Unmark as favorite
    await Favorite.findOneAndDelete({ user: userId, product: productId });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Product unmarked as favorite",
    });
  } else {
    // Mark as favorite
    const newFavorite = await Favorite.create({
      user: userId,
      product: productId,
    });

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Product marked as favorite",
      data: newFavorite,
    });
  }
});

exports.getAllFavoriteProducts = catchAsync(async (req, res, next) => {
  const favorites = await Favorite.find({
    user: req.user.id,
    product: { $exists: true },
  }).populate({
    path: "product",
    select: "name price description category images",
  });

  res.status(200).json({
    success: true,
    data: favorites
      .map((fav) => fav.product)
      .filter((product) => product !== null),
  });
});
