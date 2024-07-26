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
const {
  findShopAndProduct,
  checkStockAvailability,
  findCategory,
  updateOrCreateCart,
  populateCartProducts,
} = require("../Utils/helper");

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

  // Search for the product in all shops
  const shop = await Shop.findOne({ "groceries._id": productIdObject });

  if (!shop) {
    return next(new AppError("Shop or Product not found", 404));
  }

  // Find the specific grocery product
  const product = shop.groceries.id(productIdObject);
  if (!product) {
    return next(new AppError("Product not found in shop", 404));
  }

  // Check for stock availability
  if (product.quantity < quantity) {
    return next(new AppError("Insufficient stock", 400));
  }

  // Find the category of the product
  const category = shop.categories.find((cat) =>
    product.categoryName.some(
      (categoryObj) => categoryObj.categoryName === cat.categoryName
    )
  );

  if (!category) {
    return next(new AppError("Category not found in shop", 404));
  }

  // Update the cart
  // Update the cart
  if (cart && cart.products && cart.products.length > 0) {
    const existingProductIndex = cart?.products?.findIndex(
      (p) => p.product.toString() === productIdObject.toString()
    );

    if (existingProductIndex > -1) {
      // Product already exists, increase quantity
      cart.products[existingProductIndex].quantity += Number(quantity);
    } else {
      // New product, add it to the cart
      cart.products.push({
        product: productIdObject,
        quantity: Number(quantity),
        shop: shop._id,
        category: category._id,
        grocery: product._id,
      });
    }
  } else {
    // Create a new cart
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
  // if (cart) {
  //   const existingProductIndex = cart.products.findIndex((p) =>
  //     p.product.equals(productIdObject)
  //   );
  //   if (existingProductIndex > -1) {
  //     // If the product already exists in the cart, add the quantity
  //     cart.products[existingProductIndex].quantity += Number(quantity);
  //   } else {
  //     // If it's a new product, add it to the cart
  //     cart.products.push({
  //       product: productIdObject,
  //       quantity: Number(quantity),
  //       shop: shop._id,
  //       category: category._id,
  //       grocery: product._id,
  //     });
  //   }
  // } else {
  //   // If the cart doesn't exist, create a new one
  //   cart = new Cart({
  //     user: userId,
  //     products: [
  //       {
  //         product: productIdObject,
  //         quantity: Number(quantity),
  //         shop: shop._id,
  //         category: category._id,
  //         grocery: product._id,
  //       },
  //     ],
  //   });
  // }

  // await cart.save();

  // Manually populate the cart with product details and calculate total price
  const populatedProducts = await Promise.all(
    cart.products.map(async (p) => {
      const shop = await Shop.findById(p.shop);
      const grocery = shop.groceries.id(p.product);
      console.log(grocery, "here is the grocery");
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

// exports.addToCart = catchAsync(async (req, res, next) => {
//   const { productId, quantity } = req.body;
//   const userId = req.user.id;

//   if (!productId || !quantity) {
//     return next(new AppError("Product ID and quantity are required", 400));
//   }

//   const productIdObject = new mongoose.Types.ObjectId(productId);

//   try {
//     const { shop, product } = await findShopAndProduct(productIdObject);
//     checkStockAvailability(product, quantity);
//     const category = findCategory(shop, product);

//     const cart = await updateOrCreateCart(
//       userId,
//       productIdObject,
//       quantity,
//       shop,
//       category,
//       product
//     );
//     const { populatedProducts, totalCartPrice } = await populateCartProducts(
//       cart
//     );

//     res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Product added to cart",
//       data: populatedProducts,
//       totalCartPrice,
//     });
//   } catch (error) {
//     return next(error);
//   }
// });

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
    const userId = req.user._id;

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

// exports.verifyPaymentAndCreateOrder = catchAsync(async (req, res, next) => {
//   const { user } = req;
//   const { paymentIntentId, deliveryLocation, cart } = req.body;

//   // Uncomment these lines if you are using Stripe for payment processing
//   // const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
//   // if (paymentIntent.status !== "succeeded") {
//   //   return res.status(400).json({
//   //     success: false,
//   //     status: 400,
//   //     message: "Payment not successful",
//   //     data: paymentIntent,
//   //   });
//   // }

//   const productDetails = [];
//   let totalItems = 0;
//   let itemsTotal = 0;
//   let startLocation = null;
//   const shopDetails = [];

//   for (let item of cart.products) {
//     const groceryId = new mongoose.Types.ObjectId(item.grocery);
//     console.log(`Searching for shop with grocery ID: ${groceryId}`);

//     const shop = await Shop.findOne({
//       "groceries._id": groceryId,
//     });

//     if (!shop) {
//       console.error(`Shop not found for grocery ID: ${groceryId}`);
//       return res.status(404).json({
//         success: false,
//         status: 404,
//         message: `Shop not found for grocery with ID ${groceryId}`,
//       });
//     }

//     console.log(`Shop found: ${shop.shopTitle}`);

//     const grocery = shop.groceries.id(groceryId);
//     if (!grocery) {
//       console.error(
//         `Grocery not found for ID: ${groceryId} in shop ID: ${shop._id}`
//       );
//       return res.status(404).json({
//         success: false,
//         status: 404,
//         message: `Grocery with ID ${groceryId} not found in shop ${shop._id}`,
//       });
//     }

//     totalItems += item.quantity;
//     itemsTotal += item.quantity * grocery.price;

//     const categoryNames = grocery.categoryName
//       .map((cat) => cat.categoryName)
//       .join(", ");

//     productDetails.push({
//       name: grocery.productName,
//       category: categoryNames,
//       volume: grocery.volume,
//       images: grocery.productImages,
//       price: grocery.price,
//       quantity: item.quantity,
//     });

//     shopDetails.push({
//       shopName: shop.shopTitle,
//       images: shop.image,
//       location: shop.location,
//       shop: shop.id,
//     });

//     if (!startLocation) {
//       startLocation = shop.location;
//     }
//   }

//   const serviceFee = 10; // example service fee
//   const adminFee = 5; // example admin fee
//   const totalPayment = itemsTotal + serviceFee + adminFee;

//   const newOrder = await Order.create({
//     orderNumber: `ORD-${Date.now()}`,
//     customer: user._id,
//     products: cart.products,
//     startLocation,
//     endLocation: deliveryLocation,
//     itemsTotal,
//     serviceFee,
//     adminFee,
//     shop: shopDetails.id,
//     totalPayment,
//     paymentStatus: "paid",
//     orderStatus: "pending",
//   });

//   res.status(201).json({
//     success: true,
//     status: 201,
//     message: "Payment veified and Order created successfully",
//     order: {
//       orderId: newOrder.id,
//       orderNumber: newOrder.orderNumber,
//       orderStatus: newOrder.orderStatus,
//       startLocation: newOrder.startLocation,
//       endLocation: newOrder.endLocation,
//       customer: newOrder.customer,
//       itemsTotal: newOrder.itemsTotal,
//       serviceFee: newOrder.serviceFee,
//       adminFee: newOrder.adminFee,
//       totalPayment: newOrder.totalPayment,
//       paymentStatus: newOrder.paymentStatus,
//       products: productDetails,
//       shopDetails,
//     },
//   });
// });

exports.verifyPaymentAndCreateOrder = catchAsync(async (req, res, next) => {
  const { user } = req;
  const { paymentIntentId, deliveryLocation, cart } = req.body;

  // Uncomment these lines if you are using Stripe for payment processing
  // const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  // if (paymentIntent.status !== "succeeded") {
  //   return res.status(400).json({
  //     success: false,
  //     status: 400,
  //     message: "Payment not successful",
  //     data: paymentIntent,
  //   });
  // }

  const productDetails = [];
  let totalItems = 0;
  let itemsTotal = 0;
  let startLocation = null;
  const shopDetails = [];
  const shopIds = new Set();

  // Collect all shop details in parallel
  let shop;
  const shopPromises = cart.products.map(async (item) => {
    const groceryId = new mongoose.Types.ObjectId(item.grocery);
    console.log(`Searching for shop with grocery ID: ${groceryId}`);

    // const shop = await Shop.findOne({ "groceries._id": groceryId });
    shop = await Shop.findOne({ "groceries._id": groceryId });
    if (!shop) {
      throw new Error(`Shop not found for grocery ID: ${groceryId}`);
    }

    const grocery = shop.groceries.id(groceryId);
    if (!grocery) {
      throw new Error(
        `Grocery not found for ID: ${groceryId} in shop ID: ${shop._id}`
      );
    }

    totalItems += item.quantity;
    itemsTotal += item.quantity * grocery.price;

    const categoryNames = grocery.categoryName
      .map((cat) => cat.categoryName)
      .join(", ");

    productDetails.push({
      name: grocery.productName,
      category: categoryNames,
      volume: grocery.volume,
      images: grocery.productImages,
      price: grocery.price,
      quantity: item.quantity,
    });

    if (!shopIds.has(shop._id.toString())) {
      shopDetails.push({
        shopId: shop._id,
        shopName: shop.shopTitle,
        images: shop.image,
        location: shop.location,
      });

      shopIds.add(shop._id.toString());
    }

    if (!startLocation) {
      startLocation = shop.location;
    }
  });

  // Wait for all shop details to be collected
  await Promise.all(shopPromises);

  const serviceFee = 10; // example service fee
  const adminFee = 5; // example admin fee
  const totalPayment = itemsTotal + serviceFee + adminFee;

  // Map products to include the shopId
  const productWithShopIds = await Promise.all(
    cart.products.map(async (item) => {
      const shop = await Shop.findOne({ "groceries._id": item.grocery });
      return {
        shop: shop._id,
        grocery: item.grocery,
        quantity: item.quantity,
      };
    })
  );
  // console.log(productWithShopIds, "Here is the details of shop");

  // Create the order with resolved shop details
  console.log("SHOP ID BEFORE CREATING ORDER:", shop._id);
  const newOrder = await Order.create({
    orderNumber: `ORD-${Date.now()}`,
    customer: user._id,
    products: productWithShopIds,
    startLocation,
    endLocation: deliveryLocation,
    itemsTotal,
    serviceFee,
    adminFee,
    deliveryCharges: 0, // Assuming zero delivery charges for this example
    totalPayment,
    paymentStatus: "paid",
    orderStatus: "pending",
    shop: shop._id,
  });

  console.log("NEWORDER IS:", newOrder);

  res.status(201).json({
    success: true,
    status: 201,
    message: "Payment verified and Order created successfully",
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
      products: productDetails,
      shopDetails,
    },
  });
});
