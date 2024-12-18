const mongoose = require("mongoose");
const Shop = require("../Models/shopsModel");
const Order = require("../Models/orderModel");
const Earnings = require("../Models/earningsModel");
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

exports.toggleShopFavorite = catchAsync(async (req, res, next) => {
  const { user } = req;
  const shopId = req.params.id;

  console.log(`Attempting to toggle favorite status for shop: ${shopId}`);

  // Find the shop by ID
  const shop = await Shop.findById(shopId);

  if (!shop) {
    console.error(`Shop not found with ID: ${shopId}`);
    return next(new AppError("Shop not found", 404));
  }

  console.log(`Shop found: ${shop.shopTitle} - Shop ID: ${shop._id}`);

  // Check if the shop is currently a favorite for the user
  const favoriteRecord = await Favorite.findOne({
    user: user._id,
    shop: shopId,
  });

  let message;
  if (favoriteRecord) {
    // If the shop is already a favorite, remove it from the user's favorites
    await Favorite.deleteOne({ user: user._id, shop: shopId });
    shop.isFavorite = false; // Update shop's isFavorite status
    message = "Shop unmarked as favorite";
  } else {
    // If the shop is not a favorite, add it to the user's favorites
    await Favorite.create({ user: user._id, shop: shopId });
    shop.isFavorite = true; // Update shop's isFavorite status
    message = "Shop marked as favorite";
  }

  // Save the shop document
  await shop.save();

  console.log(`${message} - Shop ID: ${shopId}`);

  res.status(200).json({
    success: true,
    status: 200,
    message: message,
    data: shop,
  });
});

///////// Get all favorite shops for a user////////

exports.getAllFavoriteShops = catchAsync(async (req, res, next) => {
  const { user } = req;

  // Retrieve all favorite records for the user that are marked as favorite shops
  const favoriteRecords = await Favorite.find({
    user: user._id,
    shop: { $ne: null }, // Ensure that the favorite records have a shop
  }).populate("shop"); // Populate the shop details

  if (!favoriteRecords || favoriteRecords.length === 0) {
    return next(new AppError("No favorite shops found for this user", 404));
  }

  // Filter out shops that are marked as favorite by checking `isFavorite` status
  const favoriteShops = favoriteRecords
    .map((record) => record.shop)
    .filter((shop) => shop.isFavorite);

  if (favoriteShops.length === 0) {
    return next(new AppError("No favorite shops marked as favorite", 404));
  }

  res.status(200).json({
    success: true,
    status: 200,
    data: favoriteShops,
  });
});

////-----Shops near me -----////

exports.getNearbyShops = catchAsync(async (req, res, next) => {
  console.log("REQ_BODY IS:", req.query);
  const { latitude, longitude, maxDistance, keyword } = req.query;

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
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
        $maxDistance: parseInt(maxDistance, 10),
      },
    },
  });

  // If no nearby shops found, get at least two default shops
  if (!nearbyShops || nearbyShops.length === 0) {
    const defaultShops = await Shop.find().limit(2);
    if (!defaultShops || defaultShops.length === 0) {
      return res.status(200).json({
        success: true,
        status: 200,
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

  // If keyword is provided, filter the nearby shops using text search
  if (keyword) {
    try {
      const keywordQuery = {
        $text: { $search: keyword },
      };

      // Apply text search to the filtered nearby shops
      const filteredShops = nearbyShops.filter((shop) =>
        Shop.find({ _id: shop._id, ...keywordQuery })
      );

      // If no shops found after keyword filter
      if (!filteredShops || filteredShops.length === 0) {
        return res.status(404).json({
          success: true,
          status: 200,
          message: "No shops found with the given keyword.",
          data: [],
        });
      }

      return res.status(200).json({
        success: true,
        status: 200,
        message: "Nearby shops with the given keyword retrieved successfully.",
        data: filteredShops,
      });
    } catch (error) {
      console.error("Error applying text search:", error);
      return next(new AppError("Error applying text search", 500));
    }
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Nearby shops retrieved successfully",
    data: nearbyShops,
  });
});

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

exports.toggleProductFavorite = catchAsync(async (req, res, next) => {
  const { user } = req;
  const groceryId = req.params.id;

  // Find the shop that contains the grocery with the given groceryId
  const shop = await Shop.findOne({ "groceries._id": groceryId });

  if (!shop) {
    console.error(`Shop not found for grocery: ${groceryId}`);
    return next(new AppError("Shop not found", 404));
  }

  console.log(`Shop found: ${shop.shopTitle} - Shop ID: ${shop._id}`);

  // Find the specific grocery within the shop's groceries array
  const grocery = shop.groceries.id(groceryId);

  if (!grocery) {
    console.error(
      `Grocery not found in shop: ${shop.shopTitle} - Grocery ID: ${groceryId}`
    );
    return next(new AppError("Grocery not found", 404));
  }

  console.log(
    `Grocery found: ${grocery.productName} - Grocery ID: ${groceryId}`
  );

  // Check if the grocery is currently a favorite for the user
  const favoriteRecord = await Favorite.findOne({
    user: user._id,
    grocery: groceryId,
  });

  if (favoriteRecord) {
    // If the grocery is already a favorite, remove it from the user's favorites
    await Favorite.deleteOne({ user: user._id, grocery: groceryId });
    grocery.isFavorite = false; // Set isFavorite to false
  } else {
    // If the grocery is not a favorite, add it to the user's favorites
    await Favorite.create({
      user: user._id,
      shop: shop._id,
      grocery: groceryId,
    });
    grocery.isFavorite = true; // Set isFavorite to true
  }

  // Save the shop document
  await shop.save();

  const message = grocery.isFavorite
    ? "Grocery marked as favorite"
    : "Grocery unmarked as favorite";

  console.log(`${message} - Grocery ID: ${groceryId}`);

  res.status(200).json({
    success: true,
    status: 200,
    message: message,
    data: {
      _id: grocery._id,
      productName: grocery.productName,
      price: grocery.price,
      description: grocery.description,
      productImages: grocery.productImages,
      volume: grocery.volume,
      manufacturedBy: grocery.manufacturedBy,
      quantity: grocery.quantity,
      stockStatus: grocery.stockStatus,
      isFavorite: grocery.isFavorite,
    },
    shopDetail: {
      shopTitle: shop.shopTitle,
      location: shop.location,
      owner: shop.owner,
    },
  });
});

exports.getAllFavoriteProducts = catchAsync(async (req, res, next) => {
  const { user } = req;

  // Retrieve the user's favorite records with shop and grocery details
  const favoriteProducts = await Favorite.aggregate([
    { $match: { user: user._id } },
    {
      $lookup: {
        from: "shops",
        localField: "shop",
        foreignField: "_id",
        as: "shopDetails",
      },
    },
    { $unwind: "$shopDetails" },
    {
      $project: {
        product: {
          $filter: {
            input: "$shopDetails.groceries",
            as: "grocery",
            cond: { $eq: ["$$grocery._id", "$grocery"] },
          },
        },
        shopDetails: 1,
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        data: {
          _id: "$product._id",
          productName: "$product.productName",
          price: "$product.price",
          description: "$product.description",
          productImages: "$product.productImages",
          volume: "$product.volume",
          manufacturedBy: "$product.manufacturedBy",
          quantity: "$product.quantity",
          stockStatus: "$product.stockStatus",
          isFavorite: "$product.isFavorite",
        },
        shopDetail: {
          shopTitle: "$shopDetails.shopTitle",
          location: "$shopDetails.location",
          owner: "$shopDetails.owner",
        },
      },
    },
  ]);

  if (!favoriteProducts || favoriteProducts.length === 0) {
    return next(new AppError("No favorite products found for this user", 200));
  }

  res.status(200).json({
    success: true,
    status: 200,
    data: favoriteProducts.map((fp) => ({
      _id: fp.data._id,
      productName: fp.data.productName,
      price: fp.data.price,
      description: fp.data.description,
      productImages: fp.data.productImages,
      volume: fp.data.volume,
      manufacturedBy: fp.data.manufacturedBy,
      quantity: fp.data.quantity,
      stockStatus: fp.data.stockStatus,
      isFavorite: fp.data.isFavorite,
      shopDetail: {
        shopTitle: fp.shopDetail.shopTitle,
        location: {
          type: fp.shopDetail.location.type,
          coordinates: fp.shopDetail.location.coordinates,
          address: fp.shopDetail.location.address,
        },
        owner: fp.shopDetail.owner,
      },
    })),
  });
});

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
      return next(new AppError("Shop or product not found", 200));
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
      return next(new AppError("Shop not found", 200));
    }

    console.log(`Shop found: ${shop.shopTitle} - Shop ID: ${shop._id}`);

    // Find the specific product within the shop's groceries array
    const product = shop.groceries.id(productId);

    if (!product) {
      console.error(
        `Product not found in shop: ${shop.shopTitle} - Product ID: ${productId}`
      );
      return next(new AppError("Product not found", 200));
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
        return next(new AppError("Category not found", 200));
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

// exports.getShopOrderStats = catchAsync(async (req, res, next) => {
//   const userId = req.user.id;

//   // Find the shop for the current user
//   const shop = await Shop.findOne({ owner: userId });
//   if (!shop) {
//     return next(new AppError("Shop not found", 404));
//   }

//   const shopId = shop.id;

//   // Count the number of completed orders for the shop
//   const completedOrders = await Order.countDocuments({
//     "products.shop": shopId,
//     orderStatus: "completed",
//   });

//   // Count the number of pending orders for the shop
//   const pendingOrders = await Order.countDocuments({
//     "products.shop": shopId,
//     orderStatus: { $ne: "completed" },
//   });

//   // Calculate the total earnings for the shop from completed orders
//   const totalEarningsData = await Order.aggregate([
//     {
//       $match: {
//         "products.shop": new mongoose.Types.ObjectId(shopId),
//         orderStatus: "completed",
//       },
//     },
//     {
//       $unwind: "$products", // Unwind products array to access individual product entries
//     },
//     {
//       $match: {
//         "products.shop": new mongoose.Types.ObjectId(shopId), // Match specific shop in products
//       },
//     },
//     {
//       $group: { _id: null, totalEarnings: { $sum: "$shopEarnings" } },
//     },
//   ]);

//   const totalEarnings = totalEarningsData.length
//     ? totalEarningsData[0].totalEarnings
//     : 0;

//   // Send the response with the calculated statistics
//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Shop order stats retrieved successfully",
//     data: {
//       completedOrders,
//       pendingOrders,
//       totalEarnings,
//     },
//   });
// });

exports.getShopOrderStats = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  // Find the shop for the current user
  const shop = await Shop.findOne({ owner: userId });
  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }

  const shopId = shop._id;

  // Count the number of completed orders for the shop
  const completedOrders = await Order.countDocuments({
    "products.shop": shopId,
    orderStatus: "completed",
  });

  // Count the number of pending orders for the shop
  const pendingOrders = await Order.countDocuments({
    "products.shop": shopId,
    orderStatus: "accepted by owner",
  });

  // Calculate the total earnings for the shop from the Earnings model
  const totalEarningsData = await Earnings.aggregate([
    {
      $match: {
        shop: new mongoose.Types.ObjectId(shopId),
        type: "shop", // Only shop earnings
      },
    },
    {
      $group: { _id: null, totalEarnings: { $sum: "$amount" } },
    },
  ]);

  const totalEarnings = totalEarningsData.length
    ? totalEarningsData[0].totalEarnings
    : 0;

  // Send the response with the calculated statistics
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

exports.getAllCategories = catchAsync(async (req, res, next) => {
  // Fetch all shops
  const shops = await Shop.find();

  if (!shops || shops.length === 0) {
    return next(new AppError("No shops found", 200));
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

////---Get completed orders by shop

// exports.getCompletedOrdersByShop = catchAsync(async (req, res, next) => {
//   const shopId = req.params.id;

//   // Find the shop by ID to ensure it exists
//   const shop = await Shop.findById(shopId);
//   if (!shop) {
//     return next(new AppError("Shop not found", 404));
//   }

//   // Find all orders that are marked as 'delivered' and include the provided shopId in their products
//   const completedOrders = await Order.find({
//     orderStatus: "completed", // Filter orders by 'delivered' status
//     "products.shop": shopId, // Filter orders where the shop is part of the order's products
//   })
//     .populate("products.shop", "shopTitle image location owner") // Populate shop details
//     .populate("customer", "name email") // Populate customer details if needed
//     .populate("driver", "name email") // Populate driver details if needed
//     .select("-__v"); // Exclude internal versioning field

//   // Return a success response with the completed orders
//   res.status(200).json({
//     success: true,
//     status: 200,
//     results: completedOrders.length,
//     data: {
//       shopDetails: {
//         shopTitle: shop.shopTitle,
//         shopType: shop.shopType,
//         owner: shop.owner,
//         location: shop.location,
//       },
//       orderSummary: completedOrders,
//     },
//   });
// });

// exports.getCompletedOrdersByShop = catchAsync(async (req, res, next) => {
//   const shopId = req.params.id; // Get the shopId from request parameters

//   // Find the shop by ID to ensure it exists
//   const shop = await Shop.findById(shopId);
//   if (!shop) {
//     return next(new AppError("Shop not found", 404));
//   }

//   // Find all orders that are marked as 'completed' and include the provided shopId in their products
//   const completedOrders = await Order.find({
//     orderStatus: "completed", // Filter orders by 'completed' status
//     "products.shop": shopId, // Filter orders where the shop is part of the order's products
//   })
//     .populate("products.shop", "shopTitle image location owner") // Populate shop details
//     .populate("customer", "firstName lastName email image location") // Populate customer details
//     .populate("driver", "firstName lastName email image location") // Populate driver (rider) details
//     .select("-__v"); // Exclude internal versioning field

//   // Map the completed orders to the required format
//   const formattedOrders = completedOrders.map((order) => ({
//     orderNumber: order.orderNumber,
//     riderStatus: order.riderStatus,
//     orderType: order.orderType,
//     totalListItems: order.totalListItems,
//     _id: order._id,
//     customer: order.customer
//       ? {
//           location: order.customer.location,
//           _id: order.customer._id,
//           firstName: order.customer.firstName,
//           lastName: order.customer.lastName,
//           email: order.customer.email,
//           image: order.customer.image,
//           id: order.customer._id.toString(),
//         }
//       : {}, // Handle case where customer is undefined
//     shopDetailWithProduct: Array.isArray(order.products)
//       ? order.products.map((product) => ({
//           shopId: product?.shop?._id?.toString() || "",
//           ownerId: product?.shop?.owner?.toString() || "",
//           shopTitle: product?.shop?.shopTitle || "",
//           image: product?.shop?.image || "",
//           location: product?.shop?.location || {},
//           isOrderAccepted: product?.isOrderAccepted || false,
//           isOrderPickedUp: product?.isOrderPickedUp || false,
//           isOrderReadyForPickup: product?.isOrderReadyForPickup || false,
//           products: Array.isArray(product?.products)
//             ? product.products.map((prod) => ({
//                 productName: prod.productName,
//                 category: Array.isArray(prod?.category)
//                   ? prod.category.map((cat) => ({
//                       categoryName: cat.categoryName,
//                       categoryImage: cat.categoryImage,
//                       _id: cat._id,
//                     }))
//                   : [], // Handle case where category is undefined
//                 volume: prod.volume,
//                 quantity: prod.quantity,
//                 productImages: prod.productImages || [],
//                 price: prod.price,
//               }))
//             : [], // Handle case where products are undefined
//           shopTotal: product?.shopTotal || 0,
//         }))
//       : [], // Handle case where order.products is undefined
//     orderTotal: order.orderTotal,
//     rider: order.driver
//       ? {
//           location: order.driver.location,
//           _id: order.driver._id,
//           firstName: order.driver.firstName,
//           lastName: order.driver.lastName,
//           email: order.driver.email,
//           image: order.driver.image,
//           id: order.driver._id.toString(),
//         }
//       : {}, // Handle case where driver is undefined
//     orderStatus: order.orderStatus,
//     orderSummary: {
//       itemsTotal: order.itemsTotal,
//       totalListItems: order.listItems ? order.listItems.length : 0,
//       // listItems: order.listItems ? listItems : 0,
//       // listItems: listItems,
//       listItems: order.listItems ? order.listItems : [],
//       serviceFee: order.serviceFee,
//       adminFee: order.adminFee,
//       totalPayment: order.totalPayment,
//       paymentStatus: order.paymentStatus,
//       deliveryFee: order.deliveryCharges,
//       deliveryTime: order.deliveryTime,
//       startLocation: order.startLocation,
//       endLocation: order.endLocation,
//       deliveryPaymentStatus: order.deliveryPaymentStatus,
//       shopAcceptedOrder: order.shopAcceptedOrder,
//       shopRejectedOrder: order.shopRejectedOrder,
//     },
//   }));

//   // Return a success response with the formatted orders
//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Order details retrieved successfully",
//     order: formattedOrders.length > 0 ? formattedOrders[0] : {},
//   });
// });

exports.getCompletedOrdersByShop = catchAsync(async (req, res, next) => {
  const shopId = req.params.id; // Get the shopId from request parameters

  // Find the shop by ID to ensure it exists
  const shop = await Shop.findById(shopId);
  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }

  // Find all orders that are marked as 'completed' and include the provided shopId in their products
  const completedOrders = await Order.find({
    orderStatus: "completed", // Filter orders by 'completed' status
    "products.shop": shopId, // Filter orders where the shop is part of the order's products
  })
    .populate("products.shop", "shopTitle image location owner") // Populate shop details
    .populate("customer", "firstName lastName email image location") // Populate customer details
    .populate("driver", "firstName lastName email image location") // Populate driver (rider) details
    .select("-__v"); // Exclude internal versioning field

  // Map the completed orders to the required format
  const formattedOrders = completedOrders.map((order) => ({
    orderNumber: order.orderNumber,
    riderStatus: order.riderStatus,
    orderType: order.orderType,
    totalListItems: order.totalListItems,
    _id: order._id,
    customer: order.customer
      ? {
          location: order.customer.location,
          _id: order.customer._id,
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          email: order.customer.email,
          image: order.customer.image,
          id: order.customer._id.toString(),
        }
      : {}, // Handle case where customer is undefined
    shopDetailWithProduct: Array.isArray(order.products)
      ? order.products.map((product) => ({
          shopId: product?.shop?._id?.toString() || "",
          ownerId: product?.shop?.owner?.toString() || "",
          shopTitle: product?.shop?.shopTitle || "",
          image: product?.shop?.image || "",
          location: product?.shop?.location || {},
          isOrderAccepted: product?.isOrderAccepted || false,
          isOrderPickedUp: product?.isOrderPickedUp || false,
          isOrderReadyForPickup: product?.isOrderReadyForPickup || false,
          products: Array.isArray(product?.products)
            ? product.products.map((prod) => ({
                productName: prod.productName,
                category: Array.isArray(prod?.category)
                  ? prod.category.map((cat) => ({
                      categoryName: cat.categoryName,
                      categoryImage: cat.categoryImage,
                      _id: cat._id,
                    }))
                  : [], // Handle case where category is undefined
                volume: prod.volume,
                quantity: prod.quantity,
                productImages: prod.productImages || [],
                price: prod.price,
              }))
            : [], // Handle case where products are undefined
          shopTotal: product?.shopTotal || 0,
        }))
      : [], // Handle case where order.products is undefined
    orderTotal: order.orderTotal,
    rider: order.driver
      ? {
          location: order.driver.location,
          _id: order.driver._id,
          firstName: order.driver.firstName,
          lastName: order.driver.lastName,
          email: order.driver.email,
          image: order.driver.image,
          id: order.driver._id.toString(),
        }
      : {}, // Handle case where driver is undefined
    orderStatus: order.orderStatus,
    orderSummary: {
      itemsTotal: order.itemsTotal,
      totalListItems: order.listItems ? order.listItems.length : 0,
      listItems: order.listItems ? order.listItems : [],
      serviceFee: order.serviceFee,
      adminFee: order.adminFee,
      totalPayment: order.totalPayment,
      paymentStatus: order.paymentStatus,
      deliveryFee: order.deliveryCharges,
      deliveryTime: order.deliveryTime,
      startLocation: order.startLocation,
      endLocation: order.endLocation,
      deliveryPaymentStatus: order.deliveryPaymentStatus,
      shopAcceptedOrder: order.shopAcceptedOrder,
      shopRejectedOrder: order.shopRejectedOrder,
    },
  }));

  // Return a success response with all formatted orders
  res.status(200).json({
    success: true,
    status: 200,
    message: "Completed orders retrieved successfully",
    results: formattedOrders.length,
    orders: formattedOrders,
  });
});
