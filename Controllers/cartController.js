const mongoose = require("mongoose");
const catchAsync = require("../Utils/catchAsync");
const Cart = require("../Models/cartModel");
const Factory = require("../Controllers/handleFactory");
const Shop = require("../Models/shopsModel");
const Order = require("../Models/orderModel");
const User = require("../Models/userModel");
const Notification = require("../Models/notificationModel");
const {
  SendNotification,
  SendNotificationMultiCast,
} = require("../Utils/notificationSender");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const geolib = require("geolib");
const {
  calculateDistance,
  calculateExpectedDeliveryTime,
} = require("../Utils/helper");
const message = require("../Models/message");
const AppError = require("../Utils/appError");
// const { io } = require("../sockets");

exports.addToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity } = req.body;
  const userId = req.user.id;

  if (!productId || !quantity) {
    return next(new AppError("Product ID and quantity are required", 400));
  }

  const productIdObject = new mongoose.Types.ObjectId(productId);
  let cart = await Cart.findOne({ user: userId });

  // Search for the product in all shops and categories
  const shop = await Shop.findOne({
    "categories.groceries._id": productIdObject,
  });

  if (!shop) {
    return next(new AppError("Shop or Product not found", 404));
  }

  const category = shop.categories.find((cat) =>
    cat.groceries.some((grocery) => grocery._id.equals(productIdObject))
  );

  if (!category) {
    return next(new AppError("Category not found in shop", 404));
  }

  const product = category.groceries.id(productIdObject);

  if (!product) {
    return next(new AppError("Product not found in category", 404));
  }

  // Check for stock availability
  if (product.quantity < quantity) {
    return next(new AppError("Insufficient stock", 400));
  }

  // Update the cart
  if (cart) {
    const existingProductIndex = cart.products.findIndex((p) =>
      p.grocery.equals(productIdObject)
    );
    if (existingProductIndex > -1) {
      // If the product already exists in the cart, add the quantity
      cart.products[existingProductIndex].quantity += Number(quantity);
    } else {
      // If it's a new product, add it to the cart
      cart.products.push({
        product: productIdObject,
        quantity: Number(quantity),
        shop: shop._id,
        category: category._id,
        grocery: product._id,
      });
    }
  } else {
    // If the cart doesn't exist, create a new one
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
  const userId = req.user.id;

  if (!productId) {
    return next(new AppError("Product ID is required", 400));
  }

  const productIdObject = new mongoose.Types.ObjectId(productId);
  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  const productIndex = cart.products.findIndex((p) =>
    p.grocery.equals(productIdObject)
  );

  if (productIndex === -1) {
    return next(new AppError("Product not found in cart", 404));
  }

  const removedProduct = cart.products[productIndex];

  // Remove product from cart
  cart.products.splice(productIndex, 1);
  await cart.save();

  // Find the shop, category, and product to update the quantity
  const shop = await Shop.findById(removedProduct.shop);
  if (!shop) {
    return next(new AppError("Shop not found", 404));
  }

  const category = shop.categories.id(removedProduct.category);
  if (!category) {
    return next(new AppError("Category not found in shop", 404));
  }

  const product = category.groceries.id(removedProduct.grocery);
  if (!product) {
    return next(new AppError("Product not found in category", 404));
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

// exports.getCart = async (req, res, next) => {
//   try {
//     // Find the cart for the current user
//     const cart = await Cart.findOne({ user: req.user.id }).populate(
//       "products.product"
//     );

//     if (!cart) {
//       return res.status(200).json({
//         success: true,
//         status: 200,
//         data: {
//           cart: null,
//           totalProducts: 0,
//           totalPrice: 0,
//         },
//       });
//     }

//     // Calculate total products and total price
//     let totalProducts = 0;
//     let totalPrice = 0;

//     // Prepare cart products with details
//     const cartProducts = await Promise.all(
//       cart.products.map(async (cartItem) => {
//         const product = cartItem.product;
//         const shop = await Shop.findById(cartItem.shop);

//         if (!shop) {
//           throw new Error("Shop not found");
//         }

//         const category = shop.categories.id(cartItem.category);

//         if (!category) {
//           throw new Error("Category not found in shop");
//         }

//         const grocery = category.groceries.id(cartItem.grocery);

//         if (!grocery) {
//           throw new Error("Product not found in category");
//         }

//         // Calculate total price for the current product
//         const productTotalPrice = grocery.price * cartItem.quantity;

//         // Increment total products and total price
//         totalProducts += cartItem.quantity;
//         totalPrice += productTotalPrice;

//         return {
//           productId: grocery._id,
//           productName: grocery.productName,
//           volume: grocery.volume,
//           price: grocery.price,
//           quantity: cartItem.quantity,
//           totalPrice: productTotalPrice,
//           productImages: grocery.productImages,
//         };
//       })
//     );

//     // Return response with cart details
//     res.status(200).json({
//       success: true,
//       status: 200,
//       data: {
//         cart: cartProducts,
//         totalQuantity: totalProducts,
//         totalPrice,
//       },
//     });
//   } catch (error) {
//     // Handle errors
//     console.error("Error in getCart:", error.message);
//     res.status(500).json({
//       success: false,
//       status: 500,
//       message: error.message || "Internal Server Error",
//     });
//   }
// };

// exports.getCart = catchAsync(async (req, res, next) => {
//   try {
//     const userId = req.user.id;

//     // Find the cart for the current user
//     const cart = await Cart.findOne({ user: userId }).populate(
//       "products.product"
//     );

//     if (!cart) {
//       return res.status(200).json({
//         success: true,
//         status: 200,
//         data: {
//           cart: null,
//           totalProducts: 0,
//           totalPrice: 0,
//         },
//       });
//     }

//     // Calculate total products and total price
//     let totalProducts = 0;
//     let totalPrice = 0;

//     // Prepare cart products with details
//     const cartProducts = await Promise.all(
//       cart.products.map(async (cartItem) => {
//         const shop = await Shop.findById(cartItem.shop);

//         if (!shop) {
//           throw new Error("Shop not found");
//         }

//         const category = shop.categories.id(cartItem.category);

//         if (!category) {
//           throw new Error("Category not found in shop");
//         }

//         const grocery = category.groceries.id(cartItem.grocery);

//         if (!grocery) {
//           throw new Error("Product not found in category");
//         }

//         // Calculate total price for the current product
//         const productTotalPrice = grocery.price * cartItem.quantity;

//         // Increment total products and total price
//         totalProducts += cartItem.quantity;
//         totalPrice += productTotalPrice;

//         return {
//           productId: grocery._id,
//           productName: grocery.productName,
//           volume: grocery.volume,
//           price: grocery.price,
//           quantity: cartItem.quantity,
//           totalPrice: productTotalPrice,
//           productImages: grocery.productImages,
//         };
//       })
//     );

//     // Return response with cart details
//     res.status(200).json({
//       success: true,
//       status: 200,
//       data: {
//         cart: cartProducts,
//         totalQuantity: totalProducts,
//         totalPrice,
//       },
//     });
//   } catch (error) {
//     // Handle errors
//     console.error("Error in getCart:", error.message);
//     res.status(500).json({
//       success: false,
//       status: 500,
//       message: error.message || "Internal Server Error",
//     });
//   }
// });

exports.getCart = catchAsync(async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find the cart for the current user
    const cart = await Cart.findOne({ user: userId });

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
});

/////----upfate the cart------////

exports.updateCart = catchAsync(async (req, res, next) => {
  const { productId, quantity, volume } = req.body;
  const userId = req.user.id;

  // Find the cart for the logged-in user
  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    return next(new AppError("Cart not found", 400));
  }

  // Find the product in the cart
  const productIndex = cart.products.findIndex(
    (item) => item.grocery.toString() === productId
  );

  if (productIndex === -1) {
    return next(new AppError("Product not found in cart", 404));
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

  // Manually populate the updated cart products with details
  const updatedCartProducts = await Promise.all(
    cart.products.map(async (cartItem) => {
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

  // Calculate total price of all products in cart
  const totalCartPrice = updatedCartProducts.reduce(
    (acc, curr) => acc + curr.totalPrice,
    0
  );

  res.status(200).json({
    success: true,
    status: 200,
    message: "Cart updated successfully",
    data: {
      cart: updatedCartProducts,
      totalPrice: totalCartPrice,
    },
  });
});

// exports.updateCart = Factory.updateOne(Cart);
exports.deleteCart = Factory.deleteOne(Cart);

///////----Checkout------/////

exports.checkout = catchAsync(async (req, res, next) => {
  const { user } = req;
  const { deliveryLocation } = req.body;

  // Find user's cart
  const cart = await Cart.findOne({ user: user._id }).populate("products.shop");
  if (!deliveryLocation) {
    return next(new AppError("Please provide delivery address", 404));
  }

  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  // Calculate total price of the products and gather product details
  let totalPrice = 0;
  const productDetails = [];
  for (let item of cart.products) {
    const shop = await Shop.findById(item.shop).populate({
      path: "owner",
      select: "bankAccountInfo",
    });

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
    var ownerBank = shop.owner.bankAccountInfo.bankAccountId;
    console.log(ownerBank, "here is the bank account id of the owner");
    // Collect product details
    productDetails.push({
      productName: grocery.productName,
      volume: grocery.volume,
      price: grocery.price,
      quantity: item.quantity,
      images: grocery.productImages,
    });
  }

  // Calculate admin fee and rider fee
  const adminFee = totalPrice * cart.adminFeePercentage;
  console.log(adminFee, "here is the admin fee details");
  const deliveryCharges =
    cart.riderFeePerKm * calculateDistance(cart.products, deliveryLocation);
  console.log(deliveryCharges, "here is the rider fee details");

  const totalAmount = totalPrice + adminFee + cart.serviceFee;
  cart.deliveryCharges = deliveryCharges;
  await cart.save();
  // Calculate expected delivery time
  const expectedDeliveryTime = calculateExpectedDeliveryTime(
    cart.products,
    deliveryLocation,
    cart.averageSpeedKmPerHour
  );
  //// Create payment intent with Stripe
  // const paymentIntent = await stripe.paymentIntents.create(
  //   {
  //     amount: Math.round(totalAmount * 100),
  //     currency: "usd",
  //     description: "Products Payment",
  //     automatic_payment_methods: { enabled: true },
  //     metadata: { userId: req.user.id.toString() },
  //   },
  //   {
  //     stripe_account: ownerBank,
  //   }
  // );
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalAmount * 100), // Convert amount to cents
    currency: "usd",
    description: "Products Payment",
    automatic_payment_methods: { enabled: true },
    metadata: { userId: req.user.id.toString() },
    transfer_data: {
      destination: ownerBank,
    },
  });
  // Return order details and product details
  res.status(200).json({
    success: true,
    status: 200,
    totalProducts: productDetails.length,
    productDetails,
    orderSummary: {
      totalPrice,
      adminFee,
      deliveryCharges,
      totalAmount,
      expectedDeliveryTime,
      paymentIntent: paymentIntent.id,
    },
    DeliveryAddress: deliveryLocation,
  });
});

/////-----verify payment------///////

exports.verifyPaymentAndCreateOrder = catchAsync(async (req, res, next) => {
  const { user } = req;
  const { paymentIntentId, deliveryLocation } = req.body;

  // Uncomment these lines if you are using Stripe for payment processing
  // Confirm the payment intent with Stripe
  // const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  // if (paymentIntent.status !== "succeeded") {
  //   return res.status(400).json({
  //     success: false,
  //     status: 400,
  //     message: "Payment not successful",
  //     data: paymentIntent,
  //   });
  // }

  // Find user's cart and populate product details including shop
  const cart = await Cart.findOne({ user: user._id }).populate("products.shop");
  if (!cart || cart.products.length === 0) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Your Cart is Empty",
    });
  }

  // Generate a unique order number (e.g., using a timestamp)
  const orderNumber = `ORD-${Date.now()}`;

  // Initialize variables for order details
  const productDetails = [];
  let totalItems = 0;
  let itemsTotal = 0;
  const serviceFee = cart.serviceFee;
  const adminFee = cart.adminFeePercentage;
  // const deliveryCharges = cart.deliveryCharges;
  let startLocation = null;
  let shopDetails = [];

  // Iterate over the products in the cart to get their details
  for (let item of cart.products) {
    const shop = item.shop;
    if (!shop) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: `Shop with ID ${item.shop} not found`,
      });
    }
    var shopOwner = await User.findById(shop.owner);
    console.log(shopOwner, "the shop owner details");
    var FCMToken = shopOwner.deviceToken;
    console.log(FCMToken, "here is the fcm token");
    // Set the start location from the first product's shop location
    if (!startLocation) {
      startLocation = shop.location;
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

    totalItems += item.quantity;
    itemsTotal += item.quantity * grocery.price;

    productDetails.push({
      name: grocery.productName,
      volume: grocery.volume,
      images: grocery.productImages,
      price: grocery.price,
      quantity: item.quantity,
    });

    shopDetails.push({
      shopName: shop.shopTitle,
      images: shop.images,
      location: shop.location,
    });
  }

  const totalPayment = itemsTotal + serviceFee + adminFee;
  const messageBody = `New order from ${user.firstName}. Please accept or reject the order.`;

  // Create the order
  const newOrder = await Order.create({
    orderNumber,
    customer: user._id,
    products: cart.products,
    startLocation,
    endLocation: deliveryLocation,
    itemsTotal,
    serviceFee,
    adminFee,
    totalPayment,
    paymentStatus: "paid",
    deliveryCharges: cart.deliveryCharges,
    deliveryPaymentStatus: "unpaid",
    orderStatus: "pending",
  });
  newOrder.shopEarnings = totalPayment;
  await newOrder.save();

  // await SendNotification({
  //   token: FCMToken,
  //   title: `New Order from ${user.firstName}`,
  //   body: "Simply the test message",
  // });
  // await Notification.create({
  //   sender: user._id,
  //   receiver: shopOwner,
  //   data: messageBody,
  // });

  ///Clear the user's cart after creating the order
  cart.products = [];
  await cart.save();

  // Return the order details
  res.status(201).json({
    success: true,
    status: 201,
    message: "Order created successfully",
    order: {
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      orderStatus: newOrder.orderStatus,
      startLocation: newOrder.startLocation,
      endLocation: newOrder.endLocation,
      customer: newOrder.customer,
      itemsTotal: newOrder.itemsTotal,
      serviceFee: newOrder.serviceFee,
      adminFee: newOrder.adminFee,
      totalPayment: newOrder.totalPayment,
      paymentStatus: newOrder.paymentStatus,
      deliveryCharges: newOrder.deliveryCharges,
      deliveryPaymentStatus: newOrder.deliveryPaymentStatus,
      products: productDetails,
      shopDetails,
    },
  });
});

//////-----Aaccept or reject order by owner ------/////
