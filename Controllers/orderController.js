const mongoose = require("mongoose");
const catchAsync = require("../Utils/catchAsync");
const AppError = require("../Utils/appError");
const Order = require("../Models/orderModel");
const Cart = require("../Models/cartModel");
const User = require("../Models/userModel");
const Shop = require("../Models/shopsModel");
const {
  SendNotification,
  SendNotificationMultiCast,
} = require("../Utils/notificationSender");

// exports.createOrder = catchAsync(async (req, res, next) => {
//   const cart = await Cart.findOne({ user: req.user.id }).populate(
//     "products.product"
//   );

//   if (!cart || cart.products.length === 0) {
//     return next(new AppError("Your cart is empty", 400));
//   }

//   const shop = await Shop.findById(cart.products[0].product.shop);

//   const totalPrice = cart.products.reduce(
//     (total, item) => total + item.product.price * item.quantity,
//     0
//   );

//   const order = await Order.create({
//     user: req.user.id,
//     shop: shop.id,
//     products: cart.products,
//     totalPrice,
//   });

//   // Clear user's cart
//   await Cart.findOneAndDelete({ user: req.user.id });

//   // Notify nearby riders
//   sendNotificationToNearbyRiders(req.user.location.coordinates, order.id);

//   res.status(201).json({
//     success: true,
//     data: order,
//   });
// });

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { orderId, status } = req.body;

  const order = await Order.findByIdAndUpdate(
    orderId,
    { status },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: order,
  });
});

/////get user orders-----////

// exports.getAllOrdersByUser = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const orders = await Order.find({ customer: userId })
//       .populate("products.shop")
//       // .populate("products.category")
//       .populate("products.grocery")
//       .select("products") // Only include product details in orders
//       .exec();

//     if (!orders.length) {
//       return res.status(404).json({
//         success: true,
//         status: 200,
//         message: "No orders found for this user.",
//         orders,
//       });
//     }

//     // Extract details of one shop from the orders
//     const shopDetails = orders
//       .flatMap((order) => order.products.map((product) => product.shop))
//       .find((shop) => shop !== undefined); // Return only one shop details

//     // Extract just product details from orders
//     const simplifiedOrders = orders.map((order) => ({
//       products: order.products.map((product) => ({
//         productName: product.productName,
//         quantity: product.quantity,
//         isAvailable: product.isAvailable,
//         shop: product.shop, // Include the shop details with product if needed
//       })),
//     }));

//     res.status(200).json({
//       success: true,
//       status: 200,
//       orders: simplifiedOrders,
//       shopDetails,
//     });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ success: false, status: 500, message: "Server error", error });
//   }
// };

exports.getAllOrdersByUser = catchAsync(async (req, res, next) => {
  // Find all orders for the current user
  const orders = await Order.find({ customer: req.user.id }).populate(
    "customer",
    "firstName lastNmae email image location"
  );

  if (!orders || orders.length === 0) {
    return res.status(200).json({
      success: true,
      status: 200,
      message: "No orders found for this user",
      data: orders,
    });
  }

  const detailedOrders = [];
  for (const order of orders) {
    // Extract shop details from the first product
    const shopId = order.products.length > 0 ? order.products[0].shop : null;

    let shopDetails = {};
    if (shopId) {
      const shop = await Shop.findById(shopId);
      shopDetails = {
        shopId: shop._id,
        name: shop.shopTitle,
        image: shop.image,
        location: shop.location,
      };
    }

    detailedOrders.push({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      // customer: {
      //   name: req.user.firstName,
      //   email: req.user.email,
      //   image: req.user.image,
      // },
      customer: order.customer,
      shopDetails,
      productDetails: [],
      rider: order.driver ? order.driver.name : null,
    });

    // Process product details (can be a separate function if needed)
    for (const product of order.products) {
      const fetchedGrocery = await Shop.findById(product.shop) // Nested lookup for grocery
        .select({ groceries: { $elemMatch: { _id: product.grocery } } }); // Specific grocery details

      if (!fetchedGrocery || !fetchedGrocery.groceries.length) {
        continue; // Skip product if grocery not found
      }

      const grocery = fetchedGrocery.groceries[0];
      detailedOrders[detailedOrders.length - 1].productDetails.push({
        productName: grocery.productName,
        category: grocery.categoryName,
        volume: grocery.volume,
        productImages: grocery.productImages,
        price: grocery.price,
        quantity: product.quantity,
      });
    }
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

/////----get shop all orders-----////

// exports.getAllShopOrders = catchAsync(async (req, res, next) => {
//   const shopId = req.params.id;

//   // Find the shop by ID to ensure it exists
//   const shop = await Shop.findById(shopId);

//   if (!shop) {
//     return next(new AppError("Shop not found", 404));
//   }

//   // Find all orders associated with the shop
//   const orders = await Order.find({ shop: shopId })
//     .populate({
//       path: "customer",
//       select: "name email",
//     })
//     .populate({
//       path: "driver",
//       select: "name email",
//     })
//     .populate({
//       path: "products.shop",
//       select: "shopTitle location owner",
//     })
//     .populate({
//       path: "vendor",
//       select: "name email",
//     });

//   if (!orders || orders.length === 0) {
//     return next(new AppError("No orders found for this shop", 404));
//   }

//   // Returning the shop details and orders
//   res.status(200).json({
//     success: true,
//     status: 200,
//     data: {
//       shop: {
//         shopTitle: shop.shopTitle,
//         location: shop.location,
//         owner: shop.owner,
//       },
//       orders,
//     },
//   });
// });

////////// this is the controller function to get rider orders

exports.getAllAcceptedByOwnerOrders = catchAsync(async (req, res, next) => {
  // Find all orders for the current user
  const orders = await Order.find({
    orderStatus: "accepted by owner",
    rejectedBy: { $nin: [req.user._id] },
  }).populate("customer", "firstName lastName email image location");

  if (!orders || orders.length === 0) {
    return res.status(200).json({
      success: true,
      status: 200,
      message: "No orders found for this user",
      data: orders,
    });
  }

  const detailedOrders = [];
  for (const order of orders) {
    // Extract shop details from the first product
    const shopId = order.products.length > 0 ? order.products[0].shop : null;

    let shopDetails = {};
    if (shopId) {
      const shop = await Shop.findById(shopId);
      shopDetails = {
        shopId: shop._id,
        name: shop.shopTitle,
        image: shop.image,
        location: shop.location,
      };
    }

    detailedOrders.push({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      startLocation: order.startLocation,
      endLocation: order.endLocation,
      // customer: {
      //   name: req.user.firstName,
      //   email: req.user.email,
      //   image: req.user.image,
      //   // location:re.user.location
      // },
      customer: order.customer,
      shopDetails,
      productDetails: [],
      rider: order.driver ? order.driver : null,
    });

    // Process product details (can be a separate function if needed)
    for (const product of order.products) {
      const fetchedGrocery = await Shop.findById(product.shop) // Nested lookup for grocery
        .select({ groceries: { $elemMatch: { _id: product.grocery } } }); // Specific grocery details

      if (!fetchedGrocery || !fetchedGrocery.groceries.length) {
        continue; // Skip product if grocery not found
      }

      const grocery = fetchedGrocery.groceries[0];
      detailedOrders[detailedOrders.length - 1].productDetails.push({
        productName: grocery.productName,
        category: grocery.categoryName,
        volume: grocery.volume,
        productImages: grocery.productImages,
        price: grocery.price,
        quantity: product.quantity,
      });
    }
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

///////------ get all accepted by owner orders to show on rider new order screen-----/////
// exports.getAllNewAcceptedByOwnerOrders = catchAsync(async (req, res, next) => {
//   // Find all orders for the current user
//   const orders = await Order.find({
//     orderStatus: "accepted by owner",
//   }).populate("customer", "firstName lastName email image location");

//   if (!orders || orders.length === 0) {
//     return res.status(200).json({
//       success: true,
//       status: 200,
//       message: "No orders found for this user",
//       data: orders,
//     });
//   }

//   const detailedOrders = [];
//   for (const order of orders) {
//     // Extract shop details from the first product
//     const shopId = order.products.length > 0 ? order.products[0].shop : null;

//     let shopDetails = {};
//     if (shopId) {
//       const shop = await Shop.findById(shopId);
//       shopDetails = {
//         shopId: shop._id,
//         name: shop.shopTitle,
//         image: shop.image,
//         location: shop.location,
//       };
//     }

//     detailedOrders.push({
//       _id: order._id,
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       startLocation: order.startLocation,
//       endLocation: order.endLocation,
//       // customer: {
//       //   name: req.user.firstName,
//       //   email: req.user.email,
//       //   image: req.user.image,
//       //   // location:re.user.location
//       // },
//       customer: order.customer,
//       shopDetails,
//       productDetails: [],
//       rider: order.driver ? order.driver : null,
//     });

//     // Process product details (can be a separate function if needed)
//     for (const product of order.products) {
//       const fetchedGrocery = await Shop.findById(product.shop) // Nested lookup for grocery
//         .select({ groceries: { $elemMatch: { _id: product.grocery } } }); // Specific grocery details

//       if (!fetchedGrocery || !fetchedGrocery.groceries.length) {
//         continue; // Skip product if grocery not found
//       }

//       const grocery = fetchedGrocery.groceries[0];
//       detailedOrders[detailedOrders.length - 1].productDetails.push({
//         productName: grocery.productName,
//         category: grocery.categoryName,
//         volume: grocery.volume,
//         productImages: grocery.productImages,
//         price: grocery.price,
//         quantity: product.quantity,
//       });
//     }
//   }

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Orders retrieved successfully",
//     data: detailedOrders,
//   });
// });

exports.getAllNewAcceptedByOwnerOrders = catchAsync(async (req, res, next) => {
  // Find the shop of the current user
  const shop = await Shop.findOne({ owner: req.user.id });
  const shopId = shop._id;
  // const shopIds = userShops.map((shop) => shop._id);
  console.log(shopId, "here is the user shop id");
  if (!shop) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "No shop found for this user",
    });
  }
  // Find all orders for the current user's shop
  const orders = await Order.find({
    // orderStatus: "accepted by owner",
    "products.shop": shopId,
    orderStatus: { $ne: "pending" },
  }).populate("customer", "firstName lastName email image location");
  console.log(orders, "here are the shop orders");

  if (!orders || orders.length === 0) {
    return res.status(200).json({
      success: true,
      status: 200,
      message: "No orders found for this shop",
      data: orders,
    });
  }

  const detailedOrders = [];
  for (const order of orders) {
    // Extract shop details from the first product
    const shopId = order.products.length > 0 ? order.products[0].shop : null;

    let shopDetails = {};
    if (shopId) {
      const shop = await Shop.findById(shopId);
      shopDetails = {
        shopId: shop._id,
        name: shop.shopTitle,
        image: shop.image,
        location: shop.location,
      };
    }

    detailedOrders.push({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      startLocation: order.startLocation,
      endLocation: order.endLocation,
      customer: order.customer,
      shopDetails,
      productDetails: [],
      rider: order.driver ? order.driver : null,
    });

    // Process product details (can be a separate function if needed)
    for (const product of order.products) {
      const fetchedGrocery = await Shop.findById(product.shop) // Nested lookup for grocery
        .select({ groceries: { $elemMatch: { _id: product.grocery } } }); // Specific grocery details

      if (!fetchedGrocery || !fetchedGrocery.groceries.length) {
        continue; // Skip product if grocery not found
      }

      const grocery = fetchedGrocery.groceries[0];
      detailedOrders[detailedOrders.length - 1].productDetails.push({
        productName: grocery.productName,
        category: grocery.categoryName,
        volume: grocery.volume,
        productImages: grocery.productImages,
        price: grocery.price,
        quantity: product.quantity,
      });
    }
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

/////----get all orders of the riders side----/////
exports.getAllAcceptedByRiderOrders = catchAsync(async (req, res, next) => {
  // Find all orders for the current user
  const orders = await Order.find({
    // customer: req.user.id,
    orderStatus: "accepted by rider",
  }).populate("customer", "firstName lastName email image location");

  if (!orders || orders.length === 0) {
    return res.status(200).json({
      success: true,
      status: 200,
      message: "No orders found for this user",
      data: orders,
    });
  }

  const detailedOrders = [];
  for (const order of orders) {
    // Extract shop details from the first product
    const shopId = order.products.length > 0 ? order.products[0].shop : null;
    let shopDetails = {};
    if (shopId) {
      const shop = await Shop.findById(shopId);
      shopDetails = {
        shopId: shop._id,
        name: shop.shopTitle,
        image: shop.image,
        location: shop.location,
      };
    }

    detailedOrders.push({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      startLocation: order.startLocation,
      endLocation: order.endLocation,
      customer: order.customer,
      shopDetails,
      productDetails: [],
      rider: order.driver ? order.driver : null,
    });

    // Process product details (can be a separate function if needed)
    for (const product of order.products) {
      const fetchedGrocery = await Shop.findById(product.shop) // Nested lookup for grocery
        .select({ groceries: { $elemMatch: { _id: product.grocery } } }); // Specific grocery details

      if (!fetchedGrocery || !fetchedGrocery.groceries.length) {
        continue; // Skip product if grocery not found
      }

      const grocery = fetchedGrocery.groceries[0];
      detailedOrders[detailedOrders.length - 1].productDetails.push({
        productName: grocery.productName,
        category: grocery.categoryName,
        volume: grocery.volume,
        productImages: grocery.productImages,
        price: grocery.price,
        quantity: product.quantity,
      });
    }
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

// exports.getAllRiderOrders = catchAsync(async (req, res, next) => {
//   const riderId = req.params.id;

//   // Find the shop by ID to ensure it exists
//   const rider = await User.findById(riderId);

//   if (!rider) {
//     return next(new AppError("Rider not found", 404));
//   }

//   // Find all orders associated with the shop
//   const orders = await Order.find({ driver: riderId })
//     .populate({
//       path: "customer",
//       select: "name email",
//     })
//     .populate({
//       path: "driver",
//       select: "firstName email",
//     })
//     .populate({
//       path: "products.shop",
//       select: "shopTitle location owner",
//     })
//     .populate({
//       path: "vendor",
//       select: "firstName email",
//     });

//   if (!orders || orders.length === 0) {
//     return next(new AppError("No orders found for this rider", 404));
//   }

//   // Returning the shop details and orders
//   res.status(200).json({
//     success: true,
//     status: 200,
//     data: {
//       rider: {
//         riderNmae: rider.firstName,
//         location: rider.location,
//         // owner: rider.owner,
//       },
//       orders,
//     },
//   });
// });

//////////------Get one rider orders ------/////

exports.getAllRiderOrders = catchAsync(async (req, res, next) => {
  // Find all orders for the current user
  const orders = await Order.find({
    driver: req.user.id,
    orderStatus: "accepted by rider",
  }).populate("customer", "firstName lastName email image location");

  if (!orders || orders.length === 0) {
    return res.status(200).json({
      success: true,
      status: 200,
      message: "No orders found for this user",
      data: orders,
    });
  }

  const detailedOrders = [];
  for (const order of orders) {
    // Extract shop details from the first product
    const shopId = order.products.length > 0 ? order.products[0].shop : null;
    let shopDetails = {};
    if (shopId) {
      const shop = await Shop.findById(shopId);
      shopDetails = {
        shopId: shop._id,
        name: shop.shopTitle,
        image: shop.image,
        location: shop.location,
      };
    }
    const orderSummary = {
      itemsTotal: order.itemsTotal,
      serviceFee: order.serviceFee,
      adminFee: order.adminFee,
      totalPayment: order.totalPayment,
      paymentStatus: order.paymentStatus,
      deliveryFee: order.deliveryCharges,
      startLocation: order.startLocation,
      endLocation: order.endLocation,
      deliveryPaymentStatus: order.deliveryPaymentStatus,
    };

    detailedOrders.push({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      startLocation: order.startLocation,
      endLocation: order.endLocation,
      customer: order.customer,
      shopDetails,
      productDetails: [],
      orderSummary,
      rider: order.driver ? order.driver : null,
    });

    // Process product details (can be a separate function if needed)
    for (const product of order.products) {
      const fetchedGrocery = await Shop.findById(product.shop) // Nested lookup for grocery
        .select({ groceries: { $elemMatch: { _id: product.grocery } } }); // Specific grocery details

      if (!fetchedGrocery || !fetchedGrocery.groceries.length) {
        continue; // Skip product if grocery not found
      }

      const grocery = fetchedGrocery.groceries[0];
      detailedOrders[detailedOrders.length - 1].productDetails.push({
        productName: grocery.productName,
        category: grocery.categoryName,
        volume: grocery.volume,
        productImages: grocery.productImages,
        price: grocery.price,
        quantity: product.quantity,
        // orderSummary,
      });
    }
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

// exports.getAllOrdersByShop = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const shopId = await Shop.findById({ owner: userId });
//     console.log(shopId, "here is the shop id");
//     // const shopId = req.params.id;
//     const orders = await Order.find({ "products.shop": shopId })
//       .populate("products.shop")
//       .populate("products.category")
//       .populate("products.grocery")
//       .populate("customer")
//       .populate("vendor")
//       .populate("driver");

//     if (!orders.length) {
//       return res.status(404).json({
//         succes: true,
//         status: 404,
//         message: "No orders found for this shop.",
//       });
//     }

//     res.status(200).json({ succes: true, status: 200, orders });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ succes: false, status: 500, message: "Server error", error });
//   }
// };

// exports.getAllOrdersByShop = async (req, res, next) => {
//   try {
//     const userId = req.user.id;

//     // Find the shop associated with the user
//     const shop = await Shop.findOne({ owner: userId });

//     if (!shop) {
//       return res.status(404).json({
//         success: false,
//         status: 404,
//         message: "Shop not found for this user",
//       });
//     }

//     const shopId = shop._id;

//     // Find orders for the shop ID using existing logic
//     const orders = await Order.find({
//       "products.shop": shopId,
//       orderStatus: "pending",
//     })
//       .populate("products.shop")
//       .populate("products.category")
//       .populate("products.grocery")
//       .populate("customer")
//       .populate("vendor")
//       .populate("driver");

//     // if (!orders.length > 0) {
//     //   return res.status(200).json({
//     //     success: true,
//     //     status: 200,
//     //     message: "No orders found for this shop",
//     //     orders: [],
//     //   });
//     // }

//     res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Orders retrieved successfully",
//       orders,
//     });
//   } catch (error) {
//     next({
//       success: false,
//       status: 500,
//       // message: "No orders found for this shop",
//       error,
//     }); // Pass error to error handler
//   }
// };

exports.getAllOrdersByShop = catchAsync(async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find the shop associated with the user
    const shop = await Shop.findOne({ owner: userId });

    // if (!shop) {
    //   return res.status(404).json({
    //     success: false,
    //     status: 404,
    //     message: "Shop not found for this user",
    //   });
    // }

    const shopId = shop._id;
    console.log(shopId, "here is the shop id");

    const orders = await Order.find({
      "products.shop": shopId,
      orderStatus: "pending",
    })
      .populate("products.shop")
      .populate("products.category")
      .populate("products.grocery")
      .populate("customer")
      .populate("vendor")
      .populate("driver");
    console.log(orders, "here is the detail of the order");
    if (!orders.length) {
      return res.status(200).json({
        success: true,
        status: 200,
        message: "No orders found for this shop",
        data: orders,
      });
    }

    res.status(200).json({
      success: true,
      status: 200,
      message: "Orders retrieved successfully",
      data: orders,
    });
  } catch (error) {
    next({
      success: false,
      status: 500,
      error: error,
    });
  }
});

/////------Get all orders accepted by ht shop owner----///

// exports.getAllAcceptedOrders = catchAsync(async (req, res, next) => {
//   // Find all orders with the status "accepted by owner"
//   const orders = await Order.find({ orderStatus: "accepted by owner" })
//     .populate("customer", "firstName email image")
//     .populate("driver", "name")
//     .populate({
//       path: "products.shop",
//       select: "shopTitle image location groceries",
//     });

//   if (!orders || orders.length === 0) {
//     return next(
//       new AppError('No orders with status "accepted by owner" found', 404)
//     );
//   }

//   const formattedOrders = orders.map((order) => {
//     const productDetails = [];
//     const shopDetails = [];

//     order.products.forEach((item) => {
//       const shop = item.shop;
//       if (shop) {
//         const grocery = shop.groceries.id(item.grocery);
//         if (grocery) {
//           const category = grocery.categoryName
//             .map((cat) => cat.categoryName)
//             .join(", ");

//           productDetails.push({
//             name: grocery.productName,
//             category,
//             volume: grocery.volume,
//             images: grocery.productImages,
//             price: grocery.price,
//             quantity: item.quantity,
//           });

//           if (
//             !shopDetails.find(
//               (shopDetail) =>
//                 shopDetail.shopId.toString() === shop._id.toString()
//             )
//           ) {
//             shopDetails.push({
//               shopId: shop._id,
//               name: shop.shopTitle,
//               image: shop.image,
//               location: shop.location,
//             });
//           }
//         }
//       }
//     });

//     const orderSummary = {
//       itemsTotal: order.itemsTotal,
//       serviceFee: order.serviceFee,
//       adminFee: order.adminFee,
//       totalPayment: order.totalPayment,
//       paymentStatus: order.paymentStatus,
//       deliveryFee: order.deliveryCharges,
//       deliveryPaymentStatus: order.deliveryPaymentStatus,
//     };

//     return {
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       customer: {
//         name: order.customer.firstName,
//         email: order.customer.email,
//         image: order.customer.image,
//       },
//       shopDetails,
//       productDetails,
//       rider: order.driver ? order.driver.name : null,
//       orderSummary,
//     };
//   });

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Accepted orders retrieved successfully",
//     orders: formattedOrders,
//   });
// });

/////-----order-details-----////

// exports.getOrderDetails = catchAsync(async (req, res, next) => {
//   const orderId = req.params.id;

//   const order = await Order.findById(orderId)
//     .populate("customer", "firstName email image")
//     .populate("driver", "name");

//   if (!order) {
//     return next(new AppError("Order not found", 404));
//   }

//   const productDetails = [];
//   const shopDetailsMap = new Map(); // Use Map to prevent duplicates

//   for (const { shop, grocery, quantity } of order.products) {
//     try {
//       const fetchedShop = await Shop.findById(shop);
//       if (!fetchedShop) {
//         console.error(`Shop with ID ${shop} not found.`);
//         continue; // Skip to the next product
//       }

//       const fetchedGrocery = fetchedShop.groceries.id(grocery);
//       if (!fetchedGrocery) {
//         console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
//         continue; // Skip to the next product
//       }

//       const productDetail = {
//         productName: fetchedGrocery.productName,
//         category: fetchedGrocery.categoryName,
//         volume: fetchedGrocery.volume,
//         quantity: product.quantity,
//         productImages: fetchedGrocery.productImages,
//         price: fetchedGrocery.price,
//       };

//       productDetails.push(productDetail);

//       if (!shopDetailsMap.has(shop.toString())) {
//         shopDetailsMap.set(shop, {
//           shopId: shop,
//           shopTitle: fetchedShop.shopTitle,
//           image: fetchedShop.image,
//           location: fetchedShop.location,
//         });
//       }
//     } catch (error) {
//       console.error(`Error processing shop or grocery item: ${error.message}`);
//       continue; // Continue processing other items even if there's an error
//     }
//   }

//   const shopDetails = [...shopDetailsMap.values()]; // Convert Map to array

//   const orderSummary = {
//     itemsTotal: order.itemsTotal,
//     serviceFee: order.serviceFee,
//     adminFee: order.adminFee,
//     totalPayment: order.totalPayment,
//     paymentStatus: order.paymentStatus,
//     deliveryFee: order.deliveryCharges,
//     deliveryPaymentStatus: order.deliveryPaymentStatus,
//   };

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Order details retrieved successfully",
//     order: {
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       customer: {
//         name: order.customer.firstName,
//         email: order.customer.email,
//         image: order.customer.image,
//       },
//       shopDetails,
//       productDetails,
//       rider: order.driver ? order.driver.name : null,
//       orderSummary,
//     },
//   });
// });

exports.getOrderDetails = catchAsync(async (req, res, next) => {
  const orderId = req.params.id;

  const order = await Order.findById(orderId)
    .populate("customer", "firstName lastName email image location")
    .populate("driver", "name email location image");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  const productDetails = [];
  const shopDetailsMap = new Map(); // Use Map to prevent duplicates

  for (const { shop, grocery, quantity } of order.products) {
    try {
      const fetchedShop = await Shop.findById(shop);
      if (!fetchedShop) {
        console.error(`Shop with ID ${shop} not found.`);
        continue; // Skip to the next product
      }

      const fetchedGrocery = fetchedShop.groceries.id(grocery);
      if (!fetchedGrocery) {
        console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
        continue; // Skip to the next product
      }

      const productDetail = {
        productName: fetchedGrocery.productName,
        category: fetchedGrocery.categoryName,
        volume: fetchedGrocery.volume,
        quantity: quantity,
        productImages: fetchedGrocery.productImages,
        price: fetchedGrocery.price,
      };

      productDetails.push(productDetail);

      if (!shopDetailsMap.has(shop.toString())) {
        shopDetailsMap.set(shop, {
          shopId: shop,
          shopTitle: fetchedShop.shopTitle,
          image: fetchedShop.image,
          location: fetchedShop.location,
        });
      }
    } catch (error) {
      console.error(`Error processing shop or grocery item: ${error.message}`);
      continue; // Continue processing other items even if there's an error
    }
  }

  const shopDetails = [...shopDetailsMap.values()]; // Convert Map to array

  const orderSummary = {
    itemsTotal: order.itemsTotal,
    serviceFee: order.serviceFee,
    adminFee: order.adminFee,
    totalPayment: order.totalPayment,
    paymentStatus: order.paymentStatus,
    deliveryFee: order.deliveryCharges,
    startLocation: order.startLocation,
    endLocation: order.endLocation,
    deliveryPaymentStatus: order.deliveryPaymentStatus,
  };

  res.status(200).json({
    success: true,
    status: 200,
    message: "Order details retrieved successfully",
    order: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      _id: order.id,
      customer: order.customer,
      shopDetails,
      productDetails,
      rider: order.driver ? order.driver : null,
      orderSummary,
    },
  });
});

///////-----Get all orders----////

// exports.getAllShopOrders = catchAsync(async (req, res, next) => {
//   const orders = await Order.find({ vendor: { $ne: null } }) // Exclude non-shop orders
//     .populate("customer", "firstName email image")
//     .populate("driver", "name");

//   if (!orders.length) {
//     return res.status(200).json({
//       success: true,
//       message: "No shop orders found",
//       orders: [],
//     });
//   }

//   const detailedOrders = [];
//   for (const order of orders) {
//     const shopDetails = await Shop.findById(order.vendor); // Fetch shop details

//     const productDetails = [];
//     for (const product of order.products) {
//       const fetchedGrocery = await Shop.findById(product.shop) // Nested lookup for grocery
//         .select({ groceries: { $elemMatch: { _id: product.grocery } } }); // Specific grocery details

//       if (!fetchedGrocery || !fetchedGrocery.groceries.length) {
//         continue; // Skip product if grocery not found
//       }

//       const grocery = fetchedGrocery.groceries[0];
//       productDetails.push({
//         name: grocery.productName,
//         category: grocery.categoryName.join(", "),
//         volume: grocery.volume,
//         images: grocery.productImages,
//         price: grocery.price,
//         quantity: product.quantity,
//       });
//     }

//     detailedOrders.push({
//       _id: order._id,
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       customer: {
//         name: order.customer.firstName,
//         email: order.customer.email,
//         image: order.customer.image,
//       },
//       shopDetails: {
//         shopId: shopDetails._id,
//         name: shopDetails.shopTitle,
//         image: shopDetails.image,
//         location: shopDetails.location,
//       },
//       productDetails,
//       rider: order.driver ? order.driver.name : null,
//       // Include other order details like deliveryCharges, totalPayment, etc.
//     });
//   }

//   res.status(200).json({
//     success: true,
//     message: "Shop orders retrieved successfully",
//     orders: detailedOrders,
//   });
// });

/////----Accept or Reject the order function for rider-------////

exports.acceptOrRejectOrderByRider = catchAsync(async (req, res, next) => {
  const { orderId, action } = req.body;

  // Find the order by ID
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // // Check if the order is still pending
  // if (order.orderStatus !== "accepted") {
  //   return next(new AppError("Order is not accepted by owner", 400));
  // }

  // Handle the action
  if (action === "reject") {
    order.rejectedBy.push(req.user._id);
    await order.save();
    const allRiders = await User.find({ userType: "Rider" });
    console.log(allRiders, "All riders");
    // const FCMTokens = allRiders.map((rider) => rider.deviceToken);
    // await SendNotificationMultiCast({
    //   tokens: FCMTokens,
    //   title: "New order delivery request ",
    //   body: `Accept or reject the order ${order}`,
    // });
    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order rejected by any rider and notifies again to all riders",
      data: order,
    });
  } else if (action === "accept") {
    order.orderStatus = "accepted by rider";
    order.driver = req.user.id;
    await order.save();

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order accepted by rider",
      driver: order.driver,
    });
  } else {
    return next(new AppError("Invalid action, use 'accept' or 'reject'", 400));
  }
});

////////------Accept or Reject order by Owner -----////
exports.acceptOrRejectOrderByOwner = catchAsync(async (req, res, next) => {
  const { orderId, action } = req.body;

  // Find the order by ID
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // //////Check if the order is still pending
  if (order.orderStatus !== "pending") {
    return next(new AppError("Order is not in pending state ", 400));
  }

  // Handle the action
  if (action === "accept") {
    order.orderStatus = "accepted by owner";
    // order.driver = req.user.id;
    await order.save();

    // Send a notification to the all riders about the new order
    const allRiders = await User.find({ userType: "Rider" });
    console.log(allRiders, "All riders");
    // const FCMTokens = allRiders.map((rider) => rider.deviceToken);
    // console.log(FCMTokens, "FCMToken of all riders");

    // await SendNotificationMultiCast({
    //   tokens: FCMTokens,
    //   title: "New order on shop",
    //   body: `Accept or reject the order ${order}`,
    // });
    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order accepted and notifies to all riders",
      data: order,
    });
  } else if (action === "reject") {
    const customer = await User.findById(order.customer).populate(
      "deviceToken"
    );
    order.orderStatus = "rejected";
    await order.save();
    const FCMToken = customer.deviceToken;
    console.log(customer, "here is the deviceToken of costumer  bhaya");
    console.log(FCMToken, "here is the FCMToken of costume g");
    // await SendNotification({
    //   token: FCMToken,
    //   title: "Your order is rejected by the owner ",
    //   body: `Owner rejected the order ${order}`,
    // });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order rejected by shop owner",
    });
  } else {
    return next(new AppError("Invalid action, use 'accept' or 'reject'", 400));
  }
});

//// ---- ready for pickup function ----////
// exports.readyForPickup = catchAsync(async (req, res) => {});

exports.readyForPickup = async (req, res) => {
  // const orders = await Order.find({
  //   customer: req.user.id,
  //   // orderStatus: "accepted by rider",
  // });

  // if (!orders || orders.length === 0) {
  //   return res.status(200).json({
  //     success: true,
  //     status: 200,
  //     message: "No orders found for this user",
  //     orders: [],
  //   });
  // }
  // // Check if the order is accepted by a rider
  // if (orders.orderStatus !== "accepted by rider") {
  //   return res.status(200).json({
  //     success: false,
  //     status: 200,
  //     message: "The order is not accepted by a rider yet",
  //   });
  // }
  try {
    const orderId = req.params.id;

    // Find the order by ID
    const order = await Order.findById(orderId).populate({
      path: "driver",
      // select: "name email",
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Order not found",
      });
    }

    // Check if the order is accepted by a rider
    if (order.orderStatus !== "accepted by rider") {
      return res.status(200).json({
        success: false,
        status: 200,
        message: "The order is not accepted by a rider yet",
      });
    }

    // Get rider details
    const rider = order.driver;
    if (!rider) {
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Rider details are missing for the accepted order",
      });
    }

    // Notify the rider
    const notificationMessage = `Order #${order.orderNumber} is ready for pickup.`;
    const riderDetails = await User.findById(rider.id);
    console.log(riderDetails, "here is the rider details ......");

    const FCMToken = riderDetails.deviceToken;
    console.log(FCMToken, "here is the rider fcm token");
    // notifyRider(rider._id, notificationMessage);
    // await SendNotification({
    //   token: FCMToken,
    //   title: "Your order is raedy for pickup ",
    //   body: notificationMessage,
    // });

    res.status(200).json({
      success: true,
      status: 200,
      message: "Rider notified successfully",
      data: {
        riderDetails: rider,
        orderDetails: order,
      },
    });
  } catch (error) {
    console.error("Error notifying rider:", error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Server error",
      error: error.message || error,
    });
  }
};
