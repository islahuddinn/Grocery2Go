const catchAsync = require("../Utils/catchAsync");
const Cart = require("../Models/cartModel");
const Factory = require("../Controllers/handleFactory");
const Shop = require("../Models/shopsModel");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const geolib = require("geolib");

exports.addToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity } = req.body;
  let cart = await Cart.findOne({ user: req.user.id });

  // Search for the product in all shops and categories
  const shop = await Shop.findOne({ "categories.groceries._id": productId });

  if (!shop) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Shop or product not found",
    });
  }

  const category = shop.categories.find((cat) =>
    cat.groceries.some((grocery) => grocery._id.toString() === productId)
  );

  if (!category) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Category not found in shop",
    });
  }

  const product = category.groceries.id(productId);

  if (!product) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Product not found in category",
    });
  }

  // Check for stock availability
  if (product.quantity < quantity) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "Insufficient stock",
    });
  }

  // Update the cart
  if (cart) {
    const existingProductIndex = cart.products.findIndex(
      (p) => p.product.toString() === productId
    );
    if (existingProductIndex > -1) {
      // If the product already exists in the cart, add the quantity
      cart.products[existingProductIndex].quantity += Number(quantity);
    } else {
      // If it's a new product, add it to the cart
      cart.products.push({
        product: productId,
        quantity: Number(quantity),
        shop: shop._id,
        category: category._id,
        grocery: product._id,
      });
    }
  } else {
    // If the cart doesn't exist, create a new one
    cart = new Cart({
      user: req.user.id,
      products: [
        {
          product: productId,
          quantity: Number(quantity),
          shop: shop._id,
          category: category._id,
          grocery: product._id,
        },
      ],
    });
  }

  await cart.save();

  // Manually populate the cart with product details and calculate total price
  const populatedProducts = await Promise.all(
    cart.products.map(async (p) => {
      const shop = await Shop.findById(p.shop);
      const category = shop.categories.id(p.category);
      const grocery = category.groceries.id(p.grocery);
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

  // Calculate total price of all products in cart
  const totalCartPrice = populatedProducts.reduce(
    (acc, curr) => acc + curr.totalPrice,
    0
  );

  res.status(200).json({
    success: true,
    status: 200,
    message: "Product added to cart",
    data: populatedProducts,
    totalCartPrice,
  });
});

//// remove product from cart

exports.removeFromCart = catchAsync(async (req, res, next) => {
  const { productId } = req.body;
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Cart not found",
    });
  }

  const productIndex = cart.products.findIndex(
    (p) => p.product.toString() === productId
  );

  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Product not found in cart",
    });
  }

  const removedProduct = cart.products[productIndex];

  // Remove product from cart
  cart.products.splice(productIndex, 1);
  await cart.save();

  // Find the shop, category, and product to update the quantity
  const shop = await Shop.findById(removedProduct.shop);
  if (!shop) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Shop not found",
    });
  }

  const category = shop.categories.id(removedProduct.category);
  if (!category) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Category not found in shop",
    });
  }

  const product = category.groceries.id(removedProduct.grocery);
  if (!product) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Product not found in category",
    });
  }

  // Update product quantity in shop
  product.quantity += removedProduct.quantity;
  await shop.save();

  // Calculate total products and total price for the remaining products
  let totalProducts = 0;
  let totalPrice = 0;

  const remainingProducts = await Promise.all(
    cart.products.map(async (cartItem) => {
      const shop = await Shop.findById(cartItem.shop);
      const category = shop.categories.id(cartItem.category);
      const grocery = category.groceries.id(cartItem.grocery);

      // Calculate total price for the current product
      const productTotalPrice = grocery.price * cartItem.quantity;

      // Increment total products and total price
      totalProducts += cartItem.quantity;
      totalPrice += productTotalPrice;

      return {
        productId: grocery._id,
        productName: grocery.productName,
        volume: grocery.volume,
        price: grocery.price,
        quantity: cartItem.quantity,
        totalPrice: productTotalPrice,
        productImages: grocery.productImages,
      };
    })
  );

  res.status(200).json({
    success: true,
    status: 200,
    message: "Product removed from cart",
    data: {
      cart: remainingProducts,
      totalProducts,
      totalPrice,
    },
  });
});

exports.getCart = async (req, res, next) => {
  try {
    // Find the cart for the current user
    const cart = await Cart.findOne({ user: req.user.id }).populate(
      "products.product"
    );

    if (!cart) {
      return res.status(200).json({
        success: true,
        status: 200,
        data: {
          cart: null,
          totalProducts: 0,
          totalPrice: 0,
        },
      });
    }

    // Calculate total products and total price
    let totalProducts = 0;
    let totalPrice = 0;

    // Prepare cart products with details
    const cartProducts = await Promise.all(
      cart.products.map(async (cartItem) => {
        const product = cartItem.product;
        const shop = await Shop.findById(cartItem.shop);

        if (!shop) {
          throw new Error("Shop not found");
        }

        const category = shop.categories.id(cartItem.category);

        if (!category) {
          throw new Error("Category not found in shop");
        }

        const grocery = category.groceries.id(cartItem.grocery);

        if (!grocery) {
          throw new Error("Product not found in category");
        }

        // Calculate total price for the current product
        const productTotalPrice = grocery.price * cartItem.quantity;

        // Increment total products and total price
        totalProducts += cartItem.quantity;
        totalPrice += productTotalPrice;

        return {
          productId: grocery._id,
          productName: grocery.productName,
          volume: grocery.volume,
          price: grocery.price,
          quantity: cartItem.quantity,
          totalPrice: productTotalPrice,
          productImages: grocery.productImages,
        };
      })
    );

    // Return response with cart details
    res.status(200).json({
      success: true,
      status: 200,
      data: {
        cart: cartProducts,
        totalQuantity: totalProducts,
        totalPrice,
      },
    });
  } catch (error) {
    // Handle errors
    console.error("Error in getCart:", error.message);
    res.status(500).json({
      success: false,
      status: 500,
      message: error.message || "Internal Server Error",
    });
  }
};

/////
exports.updateCart = catchAsync(async (req, res, next) => {
  console.log("route hitted");
  const { productId, quantity, volume } = req.body;

  // Find the cart for the logged-in user
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return res.status(404).json({
      success: false,
      status: 400,
      message: "Cart not found",
    });
  }

  // Find the product in the cart
  const productIndex = cart.products.findIndex(
    (item) => item.product.toString() === productId
  );

  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Product not found in cart",
    });
  }

  // Update the product details
  if (quantity !== undefined) {
    cart.products[productIndex].quantity = quantity;
  }
  if (volume !== undefined) {
    cart.products[productIndex].volume = volume;
  }

  // Save the updated cart
  await cart.save();

  res.status(200).json({
    success: true,
    status: 200,
    message: "Cart updated successfully",
    data: cart,
  });
});

// exports.updateCart = Factory.updateOne(Cart);
exports.deleteCart = Factory.deleteOne(Cart);

///////----Checkout------/////

exports.checkout = catchAsync(async (req, res, next) => {
  const { user } = req;
  const { location } = req.body;

  // Find user's cart
  const cart = await Cart.findOne({ user: user._id }).populate("products.shop");

  if (!cart) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Cart not found",
    });
  }

  // Calculate total price of the products
  let totalPrice = 0;
  for (let item of cart.products) {
    const shop = await Shop.findById(item.shop);

    if (!shop) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: `Shop with ID ${item.shop} not found`,
      });
    }

    const category = shop.categories.id(item.category);
    if (!category) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: `Category with ID ${item.category} not found in shop ${shop._id}`,
      });
    }

    const grocery = category.groceries.id(item.grocery);
    if (!grocery) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: `Grocery with ID ${item.grocery} not found in category ${category._id}`,
      });
    }

    totalPrice += grocery.price * item.quantity;
  }

  // Calculate admin fee and rider fee
  const adminFee = totalPrice * cart.adminFeePercentage;
  const riderFee =
    cart.riderFeePerKm * calculateDistance(cart.products, location);
  const totalAmount = totalPrice + adminFee + riderFee;

  // Calculate expected delivery time
  const expectedDeliveryTime = calculateExpectedDeliveryTime(
    cart.products,
    location,
    cart.averageSpeedKmPerHour
  );

  // Create payment intent with Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount * 100,
    currency: "usd",
    metadata: { userId: user._id.toString() },
  });

  // Return order details
  res.status(200).json({
    success: true,
    status: 200,
    orderSummary: {
      totalPrice,
      adminFee,
      riderFee,
      totalAmount,
      expectedDeliveryTime,
      paymentIntent,
    },
    // clientSecret: paymentIntent.client_secret,
  });
});

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
