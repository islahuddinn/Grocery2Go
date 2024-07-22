const mongoose = require("mongoose");
const Shop = require("../Models/shopsModel");
const Order = require("../Models/orderModel");
const AppError = require("../Utils/appError");
const catchAsync = require("../Utils/catchAsync");
const factory = require("./handleFactory");
// const User = require("../Models/userModel");
const Favorite = require("../Models/favoriteModel");
const { loginChecks } = require("../Utils/login-checks");

///////------Shops Controllers-----//////

exports.createShop = catchAsync(async (req, res, next) => {
  const { shopTitle, image, location, operatingHours, bankAccountInfo } =
    req.body;

  const newShop = await Shop.create({
    shopTitle,
    image,
    owner: req.user._id,
    location,
    operatingHours,
    groceries: req.body.groceries || undefined,
    bankAccountInfo,
  });
  const user = req.user;
  user.isProfileCompleted = true;
  user.shopId = newShop._id;
  await user.save();
  res.act = loginChecks(user);

  res.status(201).json({
    success: true,
    status: 201,
    message: "Shop created successfully",
    data: { newShop, user },
  });
});

// exports.addShop = factory.creatOne(Shop);
exports.updateShop = factory.updateOne(Shop);
exports.getShop = factory.getOne(Shop);
exports.getAllShop = factory.getAll(Shop);
exports.deleteShop = factory.deleteOne(Shop);
//////---- Mark a shop as favorite----////

// exports.toggleShopFavorite = catchAsync(async (req, res, next) => {
//   const { shopId } = req.body;
//   const userId = req.user.id;

//   // Check if the shop is already marked as favorite
//   const favorite = await Favorite.findOne({ user: userId, shop: shopId });

//   if (favorite) {
//     // Unmark as favorite
//     await Favorite.findOneAndDelete({ user: userId, shop: shopId });

//     return res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Shop unmarked as favorite",
//     });
//   } else {
//     // Mark as favorite
//     const newFavorite = await Favorite.create({ user: userId, shop: shopId });

//     return res.status(201).json({
//       success: true,
//       status: 201,
//       message: "Shop marked as favorite",
//       data: newFavorite,
//     });
//   }
// });
exports.toggleShopFavorite = async (req, res, next) => {
  try {
    const shopId = req.params.id;

    console.log(`Attempting to toggle favorite status for shop: ${shopId}`);

    // Find the shop by ID
    const shop = await Shop.findById(shopId);

    if (!shop) {
      console.error(`Shop not found with ID: ${shopId}`);
      return next(new AppError("Shop not found", 404));
    }

    console.log(`Shop found: ${shop.shopTitle} - Shop ID: ${shop._id}`);

    // Toggle the isFavorite field
    shop.isFavorite = !shop.isFavorite;

    // Save the shop document
    await shop.save();

    const message = shop.isFavorite
      ? "Shop marked as favorite"
      : "Shop unmarked as favorite";
    console.log(`${message} - Shop ID: ${shopId}`);

    res.status(200).json({
      success: true,
      status: 200,
      message: message,
      data: shop,
    });
  } catch (error) {
    console.error(`Error in toggleShopFavorite: ${error.message}`);
    return next(new AppError("Internal Server Error", 500));
  }
};

///////// Get all favorite shops for a user////////

// exports.getAllFavoriteShops = catchAsync(async (req, res, next) => {
//   const favorites = await Favorite.find({
//     user: req.user.id,
//     shop: { $exists: true },
//   }).populate({
//     path: "shop",
//     select: "shopTitle location images owner categories",
//     populate: {
//       path: "categories",
//     },
//     populate: {
//       path: "groceries",
//     },
//   });

//   res.status(200).json({
//     success: true,
//     status: 200,
//     data: favorites.map((fav) => fav.shop).filter((shop) => shop !== null),
//   });
// });
exports.getAllFavoriteShops = catchAsync(async (req, res, next) => {
  // Find all shops where any product is marked as favorite
  const favoriteShops = await Shop.find({ "groceries.isFavorite": true })
    .populate({
      path: "categories",
    })
    .populate({
      path: "groceries",
      match: { isFavorite: true },
      select:
        "productName price description productImages volume manufacturedBy quantity stockStatus",
    });

  res.status(200).json({
    success: true,
    status: 200,
    data: favoriteShops,
  });
});

////-----Shops near me -----////

exports.getNearbyShops = catchAsync(async (req, res, next) => {
  console.log("REQ_BODY IS:", req.query);
  const { latitude, longitude, maxDistance } = req.query;

  console.log(latitude, longitude, maxDistance, "here is the data");

  if (!latitude || !longitude || !maxDistance) {
    return next(
      new AppError(
        "Please provide valid latitude, longitude, and maxDistance",
        400
      )
    );
  }

  // Find nearby shops
  const nearbyShops = await Shop.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance,
      },
    },
  });

  // If no nearby shops found, get at least two default shops
  if (!nearbyShops || nearbyShops.length === 0) {
    const defaultShops = await Shop.find().limit(2);
    if (!defaultShops || defaultShops.length === 0) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "No shops found",
        data: [],
      });
    }
    return res.status(200).json({
      success: true,
      status: 200,
      message: "No nearby shops found. Here are some default shops.",
      data: defaultShops,
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Nearby shops retrieved successfully",
    data: nearbyShops,
  });
});

////---get rendom groceries-----////

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

exports.getRandomGroceries = catchAsync(async (req, res, next) => {
  // Fetch all shops
  const shops = await Shop.find();

  if (!shops || shops.length === 0) {
    return next(new AppError("No shops found", 404));
  }

  // Collect all groceries from the fetched shops
  let allGroceries = [];
  shops.forEach((shop) => {
    allGroceries = allGroceries.concat(shop.groceries);
  });

  if (allGroceries.length === 0) {
    return next(new AppError("No groceries found in the shops", 404));
  }

  // Shuffle the array of groceries to get a random selection
  const shuffledGroceries = shuffleArray(allGroceries);

  res.status(200).json({
    success: true,
    status: 200,
    message: "Random groceries retrieved successfully",
    data: shuffledGroceries,
  });
});

///////------Shops Product Controllers-----/////

exports.getAllProduct = factory.getAll(Shop);

exports.addProduct = catchAsync(async (req, res, next) => {
  const {
    categoryName,
    productName,
    price,
    volume,
    manufacturedBy,
    quantity,
    description,
    productImages,
  } = req.body;

  // Find the shop associated with the logged-in user
  const userId = req.user.id;
  const shop = await Shop.findOne({ owner: userId });

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

exports.toggleProductFavorite = async (req, res, next) => {
  try {
    const productId = req.params.id;

    // Find the shop that contains the product with the given productId
    const shop = await Shop.findOne({ "groceries._id": productId });

    if (!shop) {
      console.error(`Shop not found for product: ${productId}`);
      return next(new AppError("Shop not found", 404));
    }

    console.log(`Shop found: ${shop.shopTitle} - Shop ID: ${shop._id}`);

    // Find the specific product within the shop's groceries array
    const product = shop.groceries.id(productId);

    if (!product) {
      console.error(
        `Product not found in shop: ${shop.shopTitle} - Product ID: ${productId}`
      );
      return next(new AppError("Product not found", 404));
    }

    console.log(
      `Product found: ${product.productName} - Product ID: ${productId}`
    );

    // Toggle the isFavorite field
    product.isFavorite = !product.isFavorite;

    // Save the shop document
    await shop.save();

    const message = product.isFavorite
      ? "Product marked as favorite"
      : "Product unmarked as favorite";

    console.log(`${message} - Product ID: ${productId}`);

    res.status(200).json({
      success: true,
      status: 200,
      message: message,
      data: product,
      shopDetail: shop,
    });
  } catch (error) {
    console.error(`Error in toggleProductFavorite: ${error.message}`);
    return next(new AppError("Internal Server Error", 500));
  }
};

// exports.getAllFavoriteProducts = catchAsync(async (req, res, next) => {
//   const favorites = await Favorite.find({
//     user: req.user._id,
//     product: { $exists: true },
//   });

//   if (!favorites || favorites.length === 0) {
//     return next(new AppError("No favorite product found", 404));
//   }

//   // Retrieve product details
//   const favoriteProducts = await Promise.all(
//     favorites.map(async (favorite) => {
//       const shop = await Shop.findOne({
//         "groceries._id": favorite.product,
//       }).populate({
//         path: "groceries._id",
//         select:
//           "productName price description productImages volume manufacturedBy quantity stockStatus",
//         populate: {
//           path: "shop",
//           select: "shopTitle location image owner categories",
//         },
//       });

//       if (!shop) {
//         return null;
//       }

//       // Find the specific grocery within the groceries array
//       const grocery = shop.groceries.find((g) =>
//         g._id.equals(favorite.product)
//       );
//       if (!grocery) {
//         return null;
//       }

//       return {
//         ...grocery.toObject(),
//         shop: {
//           shopTitle: shop.shopTitle,
//           location: shop.location,
//           image: shop.image,
//           owner: shop.owner,
//           categories: shop.categories.map((cat) => cat.categoryName),
//         },
//       };
//     })
//   );

//   const filteredProducts = favoriteProducts.filter(
//     (product) => product !== null
//   );

//   res.status(200).json({
//     success: true,
//     status: 200,
//     data: filteredProducts,
//   });
// });
exports.getAllFavoriteProducts = catchAsync(async (req, res, next) => {
  // Find all products that are marked as favorite
  const favoriteProducts = await Shop.aggregate([
    { $unwind: "$groceries" },
    { $match: { "groceries.isFavorite": true } },
    {
      $lookup: {
        from: "shops", // Assuming collection name is "shops"
        localField: "groceries._id",
        foreignField: "groceries._id",
        as: "shop",
      },
    },
    {
      $addFields: {
        shop: { $arrayElemAt: ["$shop", 0] },
      },
    },
    {
      $project: {
        _id: "$groceries._id",
        productName: "$groceries.productName",
        price: "$groceries.price",
        description: "$groceries.description",
        productImages: "$groceries.productImages",
        volume: "$groceries.volume",
        manufacturedBy: "$groceries.manufacturedBy",
        quantity: "$groceries.quantity",
        stockStatus: "$groceries.stockStatus",
        shop: {
          shopTitle: "$shop.shopTitle",
          location: "$shop.location",
          image: "$shop.image",
          owner: "$shop.owner",
          categories: "$shop.categories",
        },
      },
    },
  ]);

  if (!favoriteProducts || favoriteProducts.length === 0) {
    return next(new AppError("No favorite product found", 404));
  }

  res.status(200).json({
    success: true,
    status: 200,
    data: favoriteProducts,
  });
});

/////Delete shop product

// exports.deleteProductFromShop = catchAsync(async (req, res, next) => {
//   try {
//     const { productId } = req.body;
//     const userId = req.user.id;

//     console.log(
//       `User ID: ${userId} - Attempting to delete product: ${productId}`
//     );

//     // Find the shop associated with the logged-in user
//     const shop = await Shop.findOne({ owner: userId });
//     if (!shop) {
//       console.error(`Shop not found for user: ${userId}`);
//       return next(new AppError("Shop not found", 404));
//     }

//     console.log(`Shop found: ${shop.shopTitle} - Shop ID: ${shop._id}`);

//     // Check if the product exists in the shop's groceries
//     let productFound = false;

//     for (let grocery of shop.groceries) {
//       if (grocery._id.equals(productId)) {
//         shop.groceries.pull(productId);
//         productFound = true;
//         console.log(`Product found and removed: ${productId}`);
//         break;
//       }
//     }

//     if (!productFound) {
//       console.error(`Product not found in shop: ${productId}`);
//       return next(new AppError("Product not found in shop", 404));
//     }

//     // Save the updated shop
//     await shop.save();
//     console.log(
//       `Shop saved successfully after product deletion. Shop ID: ${shop._id}`
//     );

//     res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Product deleted successfully",
//       data: shop,
//     });
//   } catch (error) {
//     console.error(`Error in deleteProductFromShop: ${error.message}`);
//     return next(new AppError("Internal Server Error", 500));
//   }
// });

exports.deleteProductFromShop = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const userId = req.user.id;

    console.log(
      `User ID: ${userId} - Attempting to delete product: ${productId}`
    );

    // Find and update the shop by pulling the product from groceries array
    const shop = await Shop.findOneAndUpdate(
      { owner: userId, "groceries._id": productId },
      { $pull: { groceries: { _id: productId } } },
      { new: true }
    );

    if (!shop) {
      console.error(
        `Shop or product not found for user: ${userId} and product: ${productId}`
      );
      return next(new AppError("Shop or product not found", 404));
    }

    console.log(
      `Product removed successfully from shop: ${shop.shopTitle} - Shop ID: ${shop._id}`
    );

    res.status(200).json({
      success: true,
      status: 200,
      message: "Product deleted successfully",
      data: shop,
    });
  } catch (error) {
    console.error(`Error in deleteProductFromShop: ${error.message}`);
    return next(new AppError("Internal Server Error", 500));
  }
};

/////update product

// exports.updateProductInShop = catchAsync(async (req, res, next) => {
//   const { productId, productDetails } = req.body;

//   const userId = req.user.id;
//   const shop = await Shop.findOne({ owner: userId });
//   console.log(shop, "here is the owner shop");

//   if (!shop) {
//     return next(new AppError("Shop not found", 404));
//   }
//   // const shop = await Shop.findById(shopId);

//   // if (!shop) {
//   //   return next(new AppError("Shop not found", 404));
//   // }

//   let productFound = false;

//   for (let grocery of shop.groceries) {
//     if (grocery._id.equals(productId)) {
//       Object.assign(grocery, productDetails);
//       productFound = true;
//       break;
//     }
//   }

//   if (!productFound) {
//     return next(new AppError("Product not found in shop", 404));
//   }

//   await shop.save();
//   const updatedShop = shop.groceries.map((product) => ({
//     ...product.toObject(),
//     shopTitle: shop.shopTitle,
//     shopType: shop.shopType,
//   }));

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Product updated successfully",
//     data: updatedShop,
//   });
// });

exports.updateProductInShop = catchAsync(async (req, res, next) => {
  try {
    const { productId, productDetails, categoryName } = req.body;
    const userId = req.user.id;

    console.log(
      `User ID: ${userId} - Attempting to update product: ${productId}`
    );

    // Find the shop owned by the logged-in user
    const shop = await Shop.findOne({ owner: userId });

    if (!shop) {
      console.error(`Shop not found for user: ${userId}`);
      return next(new AppError("Shop not found", 404));
    }

    console.log(`Shop found: ${shop.shopTitle} - Shop ID: ${shop._id}`);

    // Find the specific product within the shop's groceries array
    const product = shop.groceries.id(productId);

    if (!product) {
      console.error(
        `Product not found in shop: ${shop.shopTitle} - Product ID: ${productId}`
      );
      return next(new AppError("Product not found", 404));
    }

    // Update the product details
    Object.assign(product, productDetails);

    // Update the category name if provided
    if (categoryName) {
      const category = shop.categories.find(
        (cat) => cat.categoryName === categoryName
      );
      if (!category) {
        console.error(`Category not found: ${categoryName}`);
        return next(new AppError("Category not found", 404));
      }
      product.categoryName = [{ categoryName: category.categoryName }];
    }

    await shop.save();

    const updatedProduct = {
      ...product.toObject(),
      shopTitle: shop.shopTitle,
      shopType: shop.shopType,
    };

    res.status(200).json({
      success: true,
      status: 200,
      message: "Product updated successfully",
      data: updatedProduct,
    });

    console.log(`Product updated successfully: ${productId}`);
  } catch (error) {
    console.error(`Error in updateProductInShop: ${error.message}`);
    return next(new AppError("Internal Server Error", 500));
  }
});

//////------Shop Statistics by owner------//////

exports.getShopOrderStats = catchAsync(async (req, res, next) => {
  // const shopId = req.params.id;
  // console.log(shopId, "here is the shop id");

  // if (!shopId) {
  //   return res.status(400).json({
  //     success: false,
  //     status: 400,
  //     message: "Shop ID is required",
  //   });
  // }

  const userId = req.user.id;
  const shop = await Shop.findOne({ owner: userId });
  const shopId = shop._id;
  console.log(shop, shopId, "here is the owner shop");

  if (!shop) {
    return next(new AppError("Shop not found", 404));
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
//////-----get all categories-----/////

// exports.getAllCategories = catchAsync(async (req, res, next) => {
//   // Fetch all shops
//   const shops = await Shop.find();

//   if (!shops || shops.length === 0) {
//     return next(new AppError("No shops found", 404));
//   }

//   // Extract and aggregate unique categories
//   const categoriesSet = new Set();
//   shops.forEach((shop) => {
//     shop.categories.forEach((category) => {
//       categoriesSet.add(category.categoryName);
//     });
//   });

//   const categories = Array.from(categoriesSet);

//   res.status(200).json({
//     success: true,
//     status: 200,
//     data: categories,
//   });
// });
exports.getAllCategories = catchAsync(async (req, res, next) => {
  // Fetch all shops
  const shops = await Shop.find();

  if (!shops || shops.length === 0) {
    return next(new AppError("No shops found", 404));
  }

  // Extract and aggregate unique categories with images
  const categoriesMap = new Map();
  shops.forEach((shop) => {
    shop.categories.forEach((category) => {
      if (!categoriesMap.has(category.categoryName)) {
        categoriesMap.set(category.categoryName, category.categoryImage);
      }
    });
  });

  const categories = Array.from(
    categoriesMap,
    ([categoryName, categoryImage]) => ({
      categoryName,
      categoryImage,
    })
  );

  res.status(200).json({
    success: true,
    status: 200,
    data: categories,
  });
});

/////---get products of a shop-----////

exports.getShopProducts = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const shop = await Shop.findOne({ owner: userId });
  console.log(shop, "here is the owner shop");

  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }
  // const shopId = req.params.id;

  // // Find the shop by ID
  // const shop = await Shop.findById(shopId);

  // if (!shop) {
  //   return next(new AppError("Shop not found", 404));
  // }

  const products = shop.groceries.map((product) => ({
    ...product.toObject(),
    shopTitle: shop.shopTitle,
    shopType: shop.shopType,
  }));

  res.status(200).json({
    success: true,
    status: 200,
    data: products,
  });
});

//////------get one product details----/////

// exports.getProductDetail = async (req, res, next) => {
//   try {
//     const productId = req.params.id;
//     const userId = req.user.id;

//     console.log(
//       `User ID: ${userId} - Attempting to get details for product: ${productId}`
//     );

//     // Find the shop owned by the logged-in user
//     const shop = await Shop.findOne({ owner: userId });

//     if (!shop) {
//       console.error(`Shop not found for user: ${userId}`);
//       return next(new AppError("Shop not found", 404));
//     }

//     console.log(`Shop found: ${shop.shopTitle} - Shop ID: ${shop._id}`);

//     // Find the specific product within the shop's groceries array
//     const product = shop.groceries.id(productId);

//     if (!product) {
//       console.error(
//         `Product not found in shop: ${shop.shopTitle} - Product ID: ${productId}`
//       );
//       return next(new AppError("Product not found", 404));
//     }

//     console.log(
//       `Product found: ${product.productName} - Product ID: ${productId}`
//     );

//     const productWithShopTitle = {
//       ...product.toObject(),
//       shopDetails: shop,
//       // shopType: shop.shopType,
//     };

//     res.status(200).json({
//       success: true,
//       status: 200,
//       data: productWithShopTitle,
//     });

//     console.log(
//       `Product details returned successfully for product: ${productId}`
//     );
//   } catch (error) {
//     console.error(`Error in getProductDetail: ${error.message}`);
//     return next(new AppError("Internal Server Error", 500));
//   }
// };

exports.getProductDetail = async (req, res, next) => {
  try {
    const productId = req.params.id;
    // const userId = req.user.id;

    // console.log(
    //   `User ID: ${userId} - Attempting to get details for product: ${productId}`
    // );

    // Find the shop that contains the product
    const shop = await Shop.findOne({ "groceries._id": productId });

    if (!shop) {
      console.error(`No shop contains the product with ID: ${productId}`);
      return next(new AppError("Product not found in any shop", 404));
    }

    console.log(
      `Shop found containing the product: ${shop.shopTitle} - Shop ID: ${shop._id}`
    );

    // Find the specific product within the shop's groceries array
    const product = shop.groceries.id(productId);

    if (!product) {
      console.error(
        `Product not found in shop: ${shop.shopTitle} - Product ID: ${productId}`
      );
      return next(new AppError("Product not found", 404));
    }

    console.log(
      `Product found: ${product.productName} - Product ID: ${productId}`
    );

    const productWithShopDetails = {
      ...product.toObject(),
      shopDetails: {
        shopTitle: shop.shopTitle,
        shopType: shop.shopType,
        location: shop.location,
        operatingHours: shop.operatingHours,
        categories: shop.categories,
      },
    };

    res.status(200).json({
      success: true,
      status: 200,
      data: productWithShopDetails,
    });

    console.log(
      `Product details returned successfully for product: ${productId}`
    );
  } catch (error) {
    console.error(`Error in getProductDetail: ${error.message}`);
    return next(new AppError("Internal Server Error", 500));
  }
};
