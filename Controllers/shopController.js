const Shop = require("../Models/shopsModel");
// const Product = require("../Models/productsModel");
const AppError = require("../Utils/appError");
const catchAsync = require("../Utils/catchAsync");
const factory = require("./handleFactory");
// const User = require("../Models/userModel");
const Favorite = require("../Models/favoriteModel");

///////------Shops Controllers-----//////

exports.createShop = catchAsync(async (req, res, next) => {
  const { shopTitle, images, location, operatingHours, categories } = req.body;

  const newShop = await Shop.create({
    shopTitle,
    images,
    owner: req.user._id,
    location,
    operatingHours,
    categories,
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
      populate: {
        path: "groceries",
      },
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

  let category = shop.categories.find(
    (cat) => cat.categoryName === categoryName
  );

  if (!category) {
    category = { categoryName, groceries: [] };
    shop.categories.push(category);
  }

  const newProduct = {
    productName,
    price,
    volume,
    manufacturedBy,
    quantity,
    description,
    productImages,
  };

  category.groceries.push(newProduct);
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
        "categories.groceries._id": favorite.product,
      }).populate({
        path: "categories.groceries._id",
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

      // Find the specific grocery within the categories
      for (const category of shop.categories) {
        const grocery = category.groceries.id(favorite.product);
        if (grocery) {
          return {
            ...grocery.toObject(),
            shop: {
              shopTitle: shop.shopTitle,
              location: shop.location,
              images: shop.images,
              owner: shop.owner,
              categories: shop.categories.map((cat) => ({
                categoryName: cat.categoryName,
              })),
            },
          };
        }
      }

      return null;
    })
  );

  res.status(200).json({
    success: true,
    status: 200,
    data: favoriteProducts.filter((product) => product !== null),
  });
});
/////Delete shop product

exports.deleteProductFromShop = catchAsync(async (req, res, next) => {
  const { shopId, productId } = req.body;

  const shop = await Shop.findById(shopId);

  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }

  let productFound = false;

  for (let category of shop.categories) {
    const productIndex = category.groceries.findIndex(
      (grocery) => grocery._id.toString() === productId
    );
    if (productIndex > -1) {
      category.groceries.splice(productIndex, 1);
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
exports.updateProductInShop = catchAsync(async (req, res, next) => {
  const { shopId, productId, productDetails } = req.body;

  const shop = await Shop.findById(shopId);

  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }

  let productFound = false;

  for (let category of shop.categories) {
    const product = category.groceries.id(productId);
    if (product) {
      Object.assign(product, productDetails);
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
