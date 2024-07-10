const mongoose = require("mongoose");
const Shop = require("../Models/shopsModel");
const Order = require("../Models/orderModel");
const AppError = require("../Utils/appError");
const catchAsync = require("../Utils/catchAsync");
const factory = require("./handleFactory");
// const User = require("../Models/userModel");
const Favorite = require("../Models/favoriteModel");

///////------Shops Controllers-----//////

exports.createShop = catchAsync(async (req, res, next) => {
  const { shopTitle, images, location, operatingHours, groceries } = req.body;

  const newShop = await Shop.create({
    shopTitle,
    images,
    owner: req.user._id,
    location,
    operatingHours,
    groceries,
  });

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

///////// Get all favorite shops for a user////////

exports.getAllFavoriteShops = catchAsync(async (req, res, next) => {
  const favorites = await Favorite.find({
    user: req.user.id,
    shop: { $exists: true },
  }).populate({
    path: "shop",
    select: "shopTitle location images owner categories",
    populate: {
      path: "categories",
    },
    populate: {
      path: "groceries",
    },
  });

  res.status(200).json({
    success: true,
    status: 200,
    data: favorites.map((fav) => fav.shop).filter((shop) => shop !== null),
  });
});

///////------Shops Product Controllers-----/////

// exports.addProduct = factory.creatOne(Product);
// exports.updateProduct = factory.updateOne(Shop);
exports.getAllProduct = factory.getAll(Shop);
// exports.deleteProduct = factory.deleteOne(Shop);

exports.addProduct = catchAsync(async (req, res, next) => {
  const {
    shopId,
    categoryName,
    productName,
    price,
    volume,
    manufacturedBy,
    quantity,
    description,
    productImages,
  } = req.body;

  const shop = await Shop.findById(shopId);

  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }

  const validCategoryNames = shop.categories.map((cat) => cat.categoryName);

  if (!validCategoryNames.includes(categoryName)) {
    return next(new AppError("Invalid category name", 400));
  }

  const newProduct = {
    productName,
    categoryName: [{ categoryName }],
    price,
    volume,
    manufacturedBy,
    quantity,
    description,
    productImages,
  };
  shop.groceries.push(newProduct);
  await shop.save();

  res.status(201).json({
    success: true,
    status: 201,
    data: shop,
  });
});

///// Mark a product as favorite
exports.toggleProductFavorite = catchAsync(async (req, res, next) => {
  const { productId } = req.body;
  const userId = req.user._id;

  // Check if the product is already marked as favorite
  const favorite = await Favorite.findOne({ user: userId, product: productId });

  if (favorite) {
    await Favorite.findOneAndDelete({ user: userId, product: productId });

    return next(new AppError("Product unmarked as favorite", 200));
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
    user: req.user._id,
    product: { $exists: true },
  });

  if (!favorites || favorites.length === 0) {
    return next(new AppError("No favorite product found", 404));
  }

  // Retrieve product details
  const favoriteProducts = await Promise.all(
    favorites.map(async (favorite) => {
      const shop = await Shop.findOne({
        "groceries._id": favorite.product,
      }).populate({
        path: "groceries._id",
        select:
          "productName price description productImages volume manufacturedBy quantity stockStatus",
        populate: {
          path: "shop",
          select: "shopTitle location images owner categories",
        },
      });

      if (!shop) {
        return null;
      }

      // Find the specific grocery within the groceries array
      const grocery = shop.groceries.find((g) =>
        g._id.equals(favorite.product)
      );
      if (!grocery) {
        return null;
      }

      return {
        ...grocery.toObject(),
        shop: {
          shopTitle: shop.shopTitle,
          location: shop.location,
          images: shop.images,
          owner: shop.owner,
          categories: shop.categories.map((cat) => cat.categoryName),
        },
      };
    })
  );

  const filteredProducts = favoriteProducts.filter(
    (product) => product !== null
  );

  res.status(200).json({
    success: true,
    status: 200,
    data: filteredProducts,
  });
});

/////Delete shop product

// exports.deleteProductFromShop = catchAsync(async (req, res, next) => {
//   const { shopId, productId } = req.body;

//   const shop = await Shop.findById(shopId);

//   if (!shop) {
//     return next(new AppError("Shop not found", 404));
//   }

//   let productFound = false;

//   for (let category of shop.categories) {
//     const productIndex = category.groceries.findIndex(
//       (grocery) => grocery._id.toString() === productId
//     );
//     if (productIndex > -1) {
//       category.groceries.splice(productIndex, 1);
//       productFound = true;
//       break;
//     }
//   }

//   if (!productFound) {
//     return next(new AppError("Product not found in shop", 404));
//   }

//   await shop.save();

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Product deleted successfully",
//     data: shop,
//   });
// });

exports.deleteProductFromShop = catchAsync(async (req, res, next) => {
  const { shopId, productId } = req.body;

  const shop = await Shop.findById(shopId);

  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }

  let productFound = false;

  for (let grocery of shop.groceries) {
    if (grocery._id.equals(productId)) {
      shop.groceries.pull(productId);
      productFound = true;
      break;
    }
  }

  if (!productFound) {
    return next(new AppError("Product not found in shop", 404));
  }

  await shop.save();

  res.status(200).json({
    success: true,
    status: 200,
    message: "Product deleted successfully",
    data: shop,
  });
});

/////update product
// exports.updateProductInShop = catchAsync(async (req, res, next) => {
//   const { shopId, productId, productDetails } = req.body;

//   const shop = await Shop.findById(shopId);

//   if (!shop) {
//     return next(new AppError("Shop not found", 404));
//   }

//   let productFound = false;

//   for (let category of shop.categories) {
//     const product = category.groceries.id(productId);
//     if (product) {
//       Object.assign(product, productDetails);
//       productFound = true;
//       break;
//     }
//   }

//   if (!productFound) {
//     return next(new AppError("Product not found in shop", 404));
//   }

//   await shop.save();

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Product updated successfully",
//     data: shop,
//   });
// });

exports.updateProductInShop = catchAsync(async (req, res, next) => {
  const { shopId, productId, productDetails } = req.body;

  const shop = await Shop.findById(shopId);

  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }

  let productFound = false;

  for (let grocery of shop.groceries) {
    if (grocery._id.equals(productId)) {
      Object.assign(grocery, productDetails);
      productFound = true;
      break;
    }
  }

  if (!productFound) {
    return next(new AppError("Product not found in shop", 404));
  }

  await shop.save();

  res.status(200).json({
    success: true,
    status: 200,
    message: "Product updated successfully",
    data: shop,
  });
});

//////------Shop Statistics by owner------//////

exports.getShopOrderStats = catchAsync(async (req, res, next) => {
  const shopId = req.params.id;
  console.log(shopId, "here is the shop id");

  if (!shopId) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "Shop ID is required",
    });
  }

  const completedOrders = await Order.countDocuments({
    "products.shop": shopId,
    orderStatus: "delivered",
  });

  const pendingOrders = await Order.countDocuments({
    "products.shop": shopId,
    orderStatus: { $ne: "delivered" },
  });

  const totalEarningsData = await Order.aggregate([
    {
      $match: {
        "products.shop": new mongoose.Types.ObjectId(shopId),
        orderStatus: "delivered",
      },
    },
    { $group: { _id: null, totalEarnings: { $sum: "$shopEarnings" } } },
  ]);

  const totalEarnings = totalEarningsData.length
    ? totalEarningsData[0].totalEarnings
    : 0;

  res.status(200).json({
    success: true,
    status: 200,
    message: "Shop order stats retrieved successfully",
    data: {
      completedOrders,
      pendingOrders,
      totalEarnings,
    },
  });
});
