const mongoose = require("mongoose");
const catchAsync = require("./catchAsync");
const AppError = require("./appError");
const Cart = require("../Models/cartModel");
const Shop = require("../Models/shopsModel");
// Helper function to calculate distance (using Haversine formula)

function calculateDistance(products, userLocation) {
  if (!products.length || !userLocation) return 0;

  const shopLocation = products[0].shop.location.coordinates;
  const [lat1, lon1] = userLocation || shopLocation;
  const [lat2, lon2] = shopLocation;

  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Helper function to calculate expected delivery time
function calculateExpectedDeliveryTime(products, userLocation, speed) {
  const distance = calculateDistance(products, userLocation);
  const time = distance / speed; // Time in hours
  return time * 60; // Convert to minutes
}

function haversineDistance(coords1, coords2) {
  if (!coords1 || !coords2 || coords1.length < 2 || coords2.length < 2) {
    throw new Error("Invalid coordinates");
  }

  const toRadians = (angle) => (angle * Math.PI) / 180;

  const lat1 = coords1[0];
  const lon1 = coords1[1];
  const lat2 = coords2[0];
  const lon2 = coords2[1];

  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in kilometers
}

// Calculate delivery charges based on distance
function calculateDeliveryCharges(startLocation, endLocation, ratePerKm = 5) {
  if (
    !startLocation ||
    !endLocation ||
    !startLocation.coordinates ||
    !endLocation.coordinates
  ) {
    throw new Error("Invalid start or end location");
  }
  const distance = haversineDistance(
    startLocation.coordinates,
    endLocation.coordinates
  );
  return distance * ratePerKm;
}

// Helper function to find a shop and product
const findShopAndProduct = async (productIdObject) => {
  const shop = await Shop.findOne({ "groceries._id": productIdObject });
  if (!shop) throw new AppError("Shop or Product not found", 404);

  const product = shop.groceries.id(productIdObject);
  if (!product) throw new AppError("Product not found in shop", 404);

  return { shop, product };
};

// Helper function to find a category
const findCategory = (shop, product) => {
  const category = shop.categories.find((cat) =>
    product.categoryName.some(
      (categoryObj) => categoryObj.categoryName === cat.categoryName
    )
  );
  if (!category) throw new AppError("Category not found in shop", 404);

  return category;
};

// Helper function to check stock availability
const checkStockAvailability = (product, quantity) => {
  if (product.quantity < quantity)
    throw new AppError("Insufficient stock", 400);
};

// Helper function to update or create a cart
const updateOrCreateCart = async (
  userId,
  productIdObject,
  quantity,
  shop,
  category,
  product
) => {
  let cart = await Cart.findOne({ user: userId });

  if (cart) {
    const existingProductIndex = cart.products.findIndex((p) =>
      p.product.equals(productIdObject)
    );
    if (existingProductIndex > -1) {
      cart.products[existingProductIndex].quantity += Number(quantity);
    } else {
      cart.products.push({
        product: productIdObject,
        quantity: Number(quantity),
        shop: shop._id,
        category: category._id,
        grocery: product._id,
      });
    }
  } else {
    cart = new Cart({
      user: userId,
      products: [
        {
          product: productIdObject,
          quantity: Number(quantity),
          shop: shop._id,
          category: category._id,
          grocery: product._id,
        },
      ],
    });
  }

  await cart.save();
  return cart;
};

// Helper function to populate products in the cart
const populateCartProducts = async (cart) => {
  const populatedProducts = await Promise.all(
    cart.products.map(async (p) => {
      const shop = await Shop.findById(p.shop);
      const grocery = shop.groceries.id(p.product);
      const totalPrice = grocery.price * p.quantity;
      return {
        productId: grocery._id,
        productName: grocery.productName,
        volume: grocery.volume,
        price: grocery.price,
        quantity: p.quantity,
        totalPrice,
      };
    })
  );

  const totalCartPrice = populatedProducts.reduce(
    (acc, curr) => acc + curr.totalPrice,
    0
  );

  return { populatedProducts, totalCartPrice };
};

module.exports = {
  findShopAndProduct,
  findCategory,
  checkStockAvailability,
  updateOrCreateCart,
  populateCartProducts,
  calculateDistance,
  calculateExpectedDeliveryTime,
  calculateDeliveryCharges,
};
