const mongoose = require("mongoose");
const catchAsync = require("../Utils/catchAsync");
const AppError = require("../Utils/appError");
const Order = require("../Models/orderModel");
const Cart = require("../Models/cartModel");
const User = require("../Models/userModel");
const Shop = require("../Models/shopsModel");
const List = require("../Models/listModel");
const {
  SendNotification,
  SendNotificationMultiCast,
} = require("../Utils/notificationSender");

//// ----update ordr status----- /////

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

/////-------get user orders-----////

exports.getAllOrdersByUser = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ customer: req.user.id }).populate(
    "customer",
    "firstName lastName email image location"
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
    const shopDetailsMap = new Map();
    let orderTotal = 0;
    let totalItems = 0;

    for (const { shop, grocery, quantity } of order.products) {
      totalItems += quantity;

      try {
        const fetchedShop = await Shop.findById(shop);
        if (!fetchedShop) {
          console.error(`Shop with ID ${shop} not found.`);
          continue;
        }

        const fetchedGrocery = fetchedShop.groceries.id(grocery);
        if (!fetchedGrocery) {
          console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
          continue;
        }

        const productDetail = {
          productName: fetchedGrocery.productName,
          category: fetchedGrocery.categoryName,
          volume: fetchedGrocery.volume,
          quantity: quantity,
          productImages: fetchedGrocery.productImages,
          price: fetchedGrocery.price,
        };

        const productTotal = fetchedGrocery.price * quantity;
        orderTotal += productTotal;

        if (!shopDetailsMap.has(shop.toString())) {
          shopDetailsMap.set(shop.toString(), {
            shopId: shop,
            shopTitle: fetchedShop.shopTitle,
            image: fetchedShop.image,
            location: fetchedShop.location,
            isOrderAccepted: fetchedShop.isOrderAccepted,
            products: [],
            shopTotal: 0,
          });
        }

        const shopDetail = shopDetailsMap.get(shop.toString());
        shopDetail.products.push(productDetail);
        shopDetail.shopTotal += productTotal;
      } catch (error) {
        console.error(
          `Error processing shop or grocery item: ${error.message}`
        );
        continue;
      }
    }

    const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
      ...shop,
      shopOrderSummary: {
        shopItems: shop.products.length,
        shopItemsTotal: shop.shopTotal.toFixed(2),
      },
    }));

    const orderSummary = {
      itemsTotal: order.itemsTotal,
      totalItems,
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
    };

    detailedOrders.push({
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      _id: order.id,
      customer: order.customer,
      shopDetails: shopDetails,
      orderTotal: orderTotal.toFixed(2),
      rider: order.driver ? order.driver.name : null,
      orderSummary,
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

/////----get shop all orders-----////

////////// -----use this is the controller function to get rider side new orders

// exports.getAllAcceptedByOwnerOrders = catchAsync(async (req, res, next) => {
//   const orders = await Order.find({
//     orderStatus: "accepted by owner",
//     rejectedBy: { $nin: [req.user._id] }, // do not show to the rejected one rider
//     isdeliveryInProgress: false,
//   }).populate("customer", "firstName lastName email image location");
//   const list = await List.find({
//     requestedRiders: req.user.id,
//     riderRejectedList: { $nin: [req.user._id] },
//   }).populate("customer");
//   console.log(list, "Here is the list reqested to rider");
//   // if (!orders || orders.length === 0) {
//   //   return res.status(200).json({
//   //     success: true,
//   //     status: 200,
//   //     message: "No orders found for this user",
//   //     data: orders,
//   //   });
//   // }

//   const detailedOrders = [];
//   for (const order of orders) {
//     const shopDetailsMap = new Map();
//     let orderTotal = 0;
//     let totalItems = 0;

//     for (const { shop, grocery, quantity } of order.products) {
//       totalItems += quantity;

//       try {
//         const fetchedShop = await Shop.findById(shop);
//         if (!fetchedShop) {
//           console.error(`Shop with ID ${shop} not found.`);
//           continue;
//         }

//         const fetchedGrocery = fetchedShop.groceries.id(grocery);
//         if (!fetchedGrocery) {
//           console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
//           continue;
//         }

//         const productDetail = {
//           productName: fetchedGrocery.productName,
//           category: fetchedGrocery.categoryName,
//           volume: fetchedGrocery.volume,
//           quantity: quantity,
//           productImages: fetchedGrocery.productImages,
//           price: fetchedGrocery.price,
//         };

//         const productTotal = fetchedGrocery.price * quantity;
//         orderTotal += productTotal;

//         if (!shopDetailsMap.has(shop.toString())) {
//           shopDetailsMap.set(shop.toString(), {
//             shopId: shop,
//             shopTitle: fetchedShop.shopTitle,
//             image: fetchedShop.image,
//             location: fetchedShop.location,
//             products: [],
//             isOrderAccepted: fetchedShop.isOrderAccepted,
//             shopTotal: 0,
//           });
//         }

//         const shopDetail = shopDetailsMap.get(shop.toString());
//         shopDetail.products.push(productDetail);
//         shopDetail.shopTotal += productTotal;
//       } catch (error) {
//         console.error(
//           `Error processing shop or grocery item: ${error.message}`
//         );
//         continue;
//       }
//     }
//     const listOrderDetails = order.listItems
//       .filter((item) => item.isAvailable)
//       .map((item) => ({
//         productName: item.productName,
//         quantity: item.quantity,
//         price: item.price,
//         customer: item.customer,
//         total: (item.quantity * item.price).toFixed(2),
//       }));

//     const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
//       ...shop,
//       shopOrderSummary: {
//         shopItems: shop.products.length,
//         shopItemsTotal: shop.shopTotal.toFixed(2),
//       },
//     }));

//     const orderSummary = {
//       itemsTotal: order.itemsTotal,
//       totalItems,
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
//       // listOrderDetails,
//     };

//     detailedOrders.push({
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       _id: order.id,
//       customer: order.customer,
//       shopDetails: shopDetails,
//       orderTotal: orderTotal.toFixed(2),
//       rider: order.driver ? order.driver.name : null,
//       orderSummary,
//       listOrderDetails,
//     });
//   }

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Orders retrieved successfully",
//     data: detailedOrders,
//   });
// });
// exports.getAllAcceptedByOwnerOrders = catchAsync(async (req, res, next) => {
//   const orders = await Order.find({
//     orderStatus: "accepted by owner",
//     rejectedBy: { $nin: [req.user._id] }, // do not show to the rejected one rider
//     isdeliveryInProgress: false,
//   }).populate("customer", "firstName lastName email image location");

//   const list = await List.find({
//     requestedRiders: req.user.id,
//     riderRejectedList: { $nin: [req.user._id] },
//   }).populate("customer");

//   console.log(list, "Here is the list requested to rider");

//   const detailedOrders = [];
//   for (const order of orders) {
//     const shopDetailsMap = new Map();
//     let orderTotal = 0;
//     let totalItems = 0;

//     for (const { shop, grocery, quantity } of order.products) {
//       totalItems += quantity;

//       try {
//         const fetchedShop = await Shop.findById(shop);
//         if (!fetchedShop) {
//           console.error(`Shop with ID ${shop} not found.`);
//           continue;
//         }

//         const fetchedGrocery = fetchedShop.groceries.id(grocery);
//         if (!fetchedGrocery) {
//           console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
//           continue;
//         }

//         const productDetail = {
//           productName: fetchedGrocery.productName,
//           category: fetchedGrocery.categoryName,
//           volume: fetchedGrocery.volume,
//           quantity: quantity,
//           productImages: fetchedGrocery.productImages,
//           price: fetchedGrocery.price,
//         };

//         const productTotal = fetchedGrocery.price * quantity;
//         orderTotal += productTotal;

//         if (!shopDetailsMap.has(shop.toString())) {
//           shopDetailsMap.set(shop.toString(), {
//             shopId: shop,
//             shopTitle: fetchedShop.shopTitle,
//             image: fetchedShop.image,
//             location: fetchedShop.location,
//             products: [],
//             isOrderAccepted: fetchedShop.isOrderAccepted,
//             shopTotal: 0,
//           });
//         }

//         const shopDetail = shopDetailsMap.get(shop.toString());
//         shopDetail.products.push(productDetail);
//         shopDetail.shopTotal += productTotal;
//       } catch (error) {
//         console.error(
//           `Error processing shop or grocery item: ${error.message}`
//         );
//         continue;
//       }
//     }

//     const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
//       ...shop,
//       shopOrderSummary: {
//         shopItems: shop.products.length,
//         shopItemsTotal: shop.shopTotal.toFixed(2),
//       },
//     }));

//     // // Check if list exists and extract list order details
//     // const listOrderDetails = list.items
//     //   .filter((item) => item.isAvailable)
//     //   .map((item) => ({
//     //     productName: item.productName,
//     //     quantity: item.quantity,
//     //     price: item.price,
//     //     total: (item.quantity * item.price).toFixed(2),
//     //   }));
//     // console.log(listOrderDetails, "here is the details of the list items");

//     const orderSummary = {
//       itemsTotal: order.itemsTotal,
//       totalItems,
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
//     };
//     const listOrderSummary = {
//       itemsTotal: list.itemsTotal,
//       startLocation: list.startLocation,
//       endLocation: list.endLocation,
//       deliveryPaymentStatus: list.deliveryPaymentStatus,
//     };

//     detailedOrders.push({
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       _id: order.id,
//       customer: order.customer,
//       shopDetails: shopDetails,
//       orderTotal: orderTotal.toFixed(2),
//       rider: order.driver ? order.driver.name : null,
//       orderSummary,
//       // listOrderDetails: listOrderDetails,
//     });
//     detailedOrders.push({
//       orderNumber: list.listOrderNumber,
//       orderStatus: list.listStatus,
//       _id: list._id,
//       customer: list.customer,
//       orderTotal: list.total,
//       rider: list.driver ? list.driver.name : null,
//       listOrderSummary,
//       // listOrderDetails: listOrderDetails,
//     });
//   }

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Orders retrieved successfully",
//     // data: { detailedOrders, listOrderDetails: list },
//     data: detailedOrders,
//   });
// });

exports.getAllAcceptedByOwnerOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({
    orderStatus: "accepted by owner",
    rejectedBy: { $nin: [req.user._id] }, // do not show to the rejected one rider
    isdeliveryInProgress: false,
  }).populate("customer", "firstName lastName email image location");

  const lists = await List.find({
    requestedRiders: req.user.id,
    riderRejectedList: { $nin: [req.user._id] },
  }).populate("customer");
  console.log(lists, "here are the lists of the rider");
  const detailedOrders = [];

  // Process orders
  for (const order of orders) {
    const shopDetailsMap = new Map();
    let orderTotal = 0;
    let totalItems = 0;

    for (const { shop, grocery, quantity } of order.products) {
      totalItems += quantity;

      try {
        const fetchedShop = await Shop.findById(shop);
        if (!fetchedShop) {
          console.error(`Shop with ID ${shop} not found.`);
          continue;
        }

        const fetchedGrocery = fetchedShop.groceries.id(grocery);
        if (!fetchedGrocery) {
          console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
          continue;
        }

        const productDetail = {
          productName: fetchedGrocery.productName,
          category: fetchedGrocery.categoryName,
          volume: fetchedGrocery.volume,
          quantity: quantity,
          productImages: fetchedGrocery.productImages,
          price: fetchedGrocery.price,
        };

        const productTotal = fetchedGrocery.price * quantity;
        orderTotal += productTotal;

        if (!shopDetailsMap.has(shop.toString())) {
          shopDetailsMap.set(shop.toString(), {
            shopId: shop,
            shopTitle: fetchedShop.shopTitle,
            image: fetchedShop.image,
            location: fetchedShop.location,
            products: [],
            isOrderAccepted: fetchedShop.isOrderAccepted,
            shopTotal: 0,
          });
        }

        const shopDetail = shopDetailsMap.get(shop.toString());
        shopDetail.products.push(productDetail);
        shopDetail.shopTotal += productTotal;
      } catch (error) {
        console.error(
          `Error processing shop or grocery item: ${error.message}`
        );
        continue;
      }
    }

    const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
      ...shop,
      shopOrderSummary: {
        shopItems: shop.products.length,
        shopItemsTotal: shop.shopTotal.toFixed(2),
      },
    }));

    const orderSummary = {
      itemsTotal: order.itemsTotal,
      totalItems,
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
    };

    detailedOrders.push({
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      orderStatus: order.orderStatus,
      _id: order.id,
      customer: order.customer,
      shopDetails: shopDetails,
      orderTotal: orderTotal.toFixed(2),
      rider: order.driver ? order.driver.name : null,
      orderSummary,
    });
  }

  // Process lists
  for (const list of lists) {
    const orderSummary = {
      itemsTotal: list.total,
      products: list.items,
      orderNumber: list.listOrderNumber,
      orderStatus: list.listStatus,
      orderType: list.orderType,
      // orderTotal: list.total,
      startLocation: list.startLocation,
      endLocation: list.endLocation,
      deliveryPaymentStatus: list.deliveryPaymentStatus,
    };
    // const quantity = list.map()
    // totalItems += list.quantity;
    console.log(list, "before pusshing to the datra.....");

    detailedOrders.push({
      orderNumber: list.listOrderNumber,
      orderType: list.orderType,
      orderStatus: list.listStatus,
      // totalItems,
      _id: list._id,
      customer: list.customer,
      orderTotal: list.total,
      rider: list.driver ? list.driver.name : null,
      orderSummary,
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

// exports.getAllAcceptedByOwnerOrders = catchAsync(async (req, res, next) => {
//   const orders = await Order.find({
//     orderStatus: "accepted by owner",
//     rejectedBy: { $nin: [req.user._id] }, // do not show to the rejected one rider
//     isdeliveryInProgress: false,
//   }).populate("customer", "firstName lastName email image location");

//   const lists = await List.find({
//     requestedRiders: req.user.id,
//     riderRejectedList: { $nin: [req.user._id] },
//   }).populate("customer", "firstName lastName image location");

//   console.log(lists, "Here are the lists requested to rider");

//   const detailedOrders = [];

//   for (const order of orders) {
//     const shopDetailsMap = new Map();
//     let orderTotal = 0;
//     let totalItems = 0;

//     for (const { shop, grocery, quantity } of order.products) {
//       totalItems += quantity;

//       try {
//         const fetchedShop = await Shop.findById(shop);
//         if (!fetchedShop) {
//           console.error(`Shop with ID ${shop} not found.`);
//           continue;
//         }

//         const fetchedGrocery = fetchedShop.groceries.id(grocery);
//         if (!fetchedGrocery) {
//           console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
//           continue;
//         }

//         const productDetail = {
//           productName: fetchedGrocery.productName,
//           category: [
//             {
//               categoryName: fetchedGrocery.categoryName,
//               categoryImage:
//                 "https://icon-library.com/images/default-profile-icon/default-profile-icon-6.jpg",
//               _id: fetchedGrocery.category._id,
//             },
//           ],
//           volume: fetchedGrocery.volume,
//           quantity: quantity,
//           productImages: fetchedGrocery.productImages,
//           price: fetchedGrocery.price,
//         };

//         const productTotal = fetchedGrocery.price * quantity;
//         orderTotal += productTotal;

//         if (!shopDetailsMap.has(shop.toString())) {
//           shopDetailsMap.set(shop.toString(), {
//             shopId: shop,
//             shopTitle: fetchedShop.shopTitle,
//             image: fetchedShop.image,
//             location: fetchedShop.location,
//             products: [],
//             isOrderAccepted: fetchedShop.isOrderAccepted,
//             shopTotal: 0,
//           });
//         }

//         const shopDetail = shopDetailsMap.get(shop.toString());
//         shopDetail.products.push(productDetail);
//         shopDetail.shopTotal += productTotal;
//       } catch (error) {
//         console.error(
//           `Error processing shop or grocery item: ${error.message}`
//         );
//         continue;
//       }
//     }

//     const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
//       ...shop,
//       shopOrderSummary: {
//         shopItems: shop.products.length,
//         shopItemsTotal: shop.shopTotal.toFixed(2),
//       },
//     }));

//     const orderSummary = {
//       itemsTotal: order.itemsTotal,
//       totalItems,
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
//     };

//     const listOrderDetails = lists
//       .filter((list) => list._id.toString() === order._id.toString())
//       .flatMap((list) => list.listItems)
//       .filter((item) => item.isAvailable)
//       .map((item) => ({
//         productName: item.productName,
//         quantity: item.quantity,
//         price: item.price,
//         total: (item.quantity * item.price).toFixed(2),
//       }));

//     detailedOrders.push({
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       _id: order.id,
//       customer: order.customer,
//       shopDetails: shopDetails,
//       orderTotal: orderTotal.toFixed(2),
//       rider: order.driver ? order.driver.name : null,
//       orderSummary,
//       listOrderDetails,
//     });
//   }

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Orders retrieved successfully",
//     data: {
//       detailedOrders,
//     },
//   });
// });

///////------ get all accepted by owner orders to show on shop new order screen-----/////

exports.getAllNewAcceptedByOwnerOrders = catchAsync(async (req, res, next) => {
  const shop = await Shop.findOne({ owner: req.user.id });
  if (!shop) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "No shop found for this user",
    });
  }

  const shopId = shop._id;

  // /// Find orders where orderStatus is "pending" and products' shop matches the shopId
  const orders = await Order.find({
    "products.shop": shopId,
    // orderStatus: "pending",
    shopAcceptedOrder: { $nin: [shopId] },
  }).populate("customer", "firstName lastName email image location");

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
    const shopDetailsMap = new Map();
    let orderTotal = 0;
    let totalItems = 0;

    for (const { shop, grocery, quantity } of order.products) {
      if (shop.toString() !== shopId.toString()) continue;
      totalItems += quantity;
      console.log(shop, "this is the id of shop being searched in shop model");
      try {
        const fetchedShop = await Shop.findById(shop);
        if (!fetchedShop) {
          console.error(`Shop with ID ${shop} not found.`);
          continue;
        }

        const fetchedGrocery = fetchedShop.groceries.id(grocery);
        if (!fetchedGrocery) {
          console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
          continue;
        }

        const productDetail = {
          productName: fetchedGrocery.productName,
          category: fetchedGrocery.categoryName,
          volume: fetchedGrocery.volume,
          quantity: quantity,
          productImages: fetchedGrocery.productImages,
          price: fetchedGrocery.price,
        };

        const productTotal = fetchedGrocery.price * quantity;
        orderTotal += productTotal;

        if (!shopDetailsMap.has(shop.toString())) {
          shopDetailsMap.set(shop.toString(), {
            shopId: shop,
            shopTitle: fetchedShop.shopTitle,
            image: fetchedShop.image,
            location: fetchedShop.location,
            isOrderAccepted: fetchedShop.isOrderAccepted,
            products: [],
            shopTotal: 0,
          });
        }

        const shopDetail = shopDetailsMap.get(shop.toString());
        shopDetail.products.push(productDetail);
        shopDetail.shopTotal += productTotal;
      } catch (error) {
        console.error(
          `Error processing shop or grocery item: ${error.message}`
        );
        continue;
      }
    }

    const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
      ...shop,
      shopOrderSummary: {
        shopItems: shop.products.length,
        shopItemsTotal: shop.shopTotal.toFixed(2),
      },
    }));

    const orderSummary = {
      itemsTotal: order.itemsTotal,
      totalItems,
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
    };

    detailedOrders.push({
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      _id: order.id,
      customer: order.customer,
      shopDetails: shopDetails,
      orderTotal: orderTotal.toFixed(2),
      rider: order.driver ? order.driver.name : null,
      orderSummary,
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

/////------shop my orders----/////
exports.getAllAcceptedByShopOrders = catchAsync(async (req, res, next) => {
  const shop = await Shop.findOne({ owner: req.user.id });
  if (!shop) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "No shop found for this user",
    });
  }

  const shopId = shop._id;
  console.log(shopId, "here is the shop");
  // Ensure the shopId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(shopId)) {
    return next(new AppError("Invalid shop ID", 400));
  }

  // Find orders where products' shop matches the shopId and isOrderAccepted is true
  // const orders = await Order.find({
  //   // "products.shop": shopId,
  //   shopAcceptedOrder: shopId,
  //   orderStatus: { $ne: "pending" }, // Exclude orders that are pending
  // }).populate("customer", "firstName lastName email image location");
  // Convert shopId to ObjectId for matching
  const shopObjectId = new mongoose.Types.ObjectId(shopId);
  const orders = await Order.find({
    shopAcceptedOrder: shopObjectId,
    orderStatus: { $ne: "pending" },
  }).populate("customer", "firstName lastName email image location");
  console.log(orders, "here is the shop order details");
  // Filter orders to include only those where the shop isOrderAccepted is true
  // const filteredOrders = orders.filter((order) =>
  //   order.products.some(
  //     (product) => product.shop.equals(shopObjectId) && shop.isOrderAccepted
  //   )
  // );
  if (!orders || orders.length === 0) {
    return next(new AppError("No orders found for this shop", 404));
  }

  // Filter orders based on shopObjectId
  // const filteredOrders = orders.filter((order) =>
  //   order.products.some((product) => product.shop.equals(shopObjectId))
  // );

  // if (!filteredOrders || filteredOrders.length === 0) {
  //   return res.status(200).json({
  //     success: true,
  //     status: 200,
  //     message: "No orders found for this shop",
  //     data: filteredOrders,
  //   });
  // }

  const detailedOrders = [];
  for (const order of orders) {
    const shopDetailsMap = new Map();
    let orderTotal = 0;
    let totalItems = 0;

    for (const { shop, grocery, quantity } of order.products) {
      if (!shop.equals(shopId)) continue;
      totalItems += quantity;
      console.log(shop, "This is the shop being searched in shop model");
      try {
        const fetchedShop = await Shop.findById(shop);
        if (!fetchedShop) {
          console.error(`Shop with ID ${shop} not found.`);
          continue;
        }

        const fetchedGrocery = fetchedShop.groceries.id(grocery);
        if (!fetchedGrocery) {
          console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
          continue;
        }

        const productDetail = {
          productName: fetchedGrocery.productName,
          category: fetchedGrocery.categoryName,
          volume: fetchedGrocery.volume,
          quantity: quantity,
          productImages: fetchedGrocery.productImages,
          price: fetchedGrocery.price,
        };

        const productTotal = fetchedGrocery.price * quantity;
        orderTotal += productTotal;

        if (!shopDetailsMap.has(shop.toString())) {
          shopDetailsMap.set(shop.toString(), {
            shopId: shop,
            shopTitle: fetchedShop.shopTitle,
            image: fetchedShop.image,
            location: fetchedShop.location,
            isOrderAccepted: fetchedShop.isOrderAccepted,
            products: [],
            shopTotal: 0,
          });
        }

        const shopDetail = shopDetailsMap.get(shop.toString());
        shopDetail.products.push(productDetail);
        shopDetail.shopTotal += productTotal;
      } catch (error) {
        console.error(
          `Error processing shop or grocery item: ${error.message}`
        );
        continue;
      }
    }

    const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
      ...shop,
      shopOrderSummary: {
        shopItems: shop.products.length,
        shopItemsTotal: shop.shopTotal.toFixed(2),
      },
    }));

    const orderSummary = {
      itemsTotal: order.itemsTotal,
      totalItems,
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
    };

    detailedOrders.push({
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      _id: order.id,
      customer: order.customer,
      shopDetails: shopDetails,
      orderTotal: orderTotal.toFixed(2),
      rider: order.driver ? order.driver.name : null,
      orderSummary,
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

/////----get all new orders of the riders side----/////

exports.getAllAcceptedByRiderOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({
    orderStatus: "accepted by rider",
    // isdeliveryInProgress: true,
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
    const shopDetailsMap = new Map();
    let orderTotal = 0;
    let totalItems = 0;

    for (const { shop, grocery, quantity } of order.products) {
      totalItems += quantity;
      console.log(shop, "this is the shop being searched in shop model");
      try {
        const fetchedShop = await Shop.findById(shop);
        if (!fetchedShop) {
          console.error(`Shop with ID ${shop} not found.`);
          continue;
        }

        const fetchedGrocery = fetchedShop.groceries.id(grocery);
        if (!fetchedGrocery) {
          console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
          continue;
        }

        const productDetail = {
          productName: fetchedGrocery.productName,
          category: fetchedGrocery.categoryName,
          volume: fetchedGrocery.volume,
          quantity: quantity,
          productImages: fetchedGrocery.productImages,
          price: fetchedGrocery.price,
        };

        const productTotal = fetchedGrocery.price * quantity;
        orderTotal += productTotal;

        if (!shopDetailsMap.has(shop.toString())) {
          shopDetailsMap.set(shop.toString(), {
            shopId: shop,
            shopTitle: fetchedShop.shopTitle,
            image: fetchedShop.image,
            location: fetchedShop.location,
            isOrderAccepted: fetchedShop.isOrderAccepted,
            products: [],
            shopTotal: 0,
          });
        }

        const shopDetail = shopDetailsMap.get(shop.toString());
        shopDetail.products.push(productDetail);
        shopDetail.shopTotal += productTotal;
      } catch (error) {
        console.error(
          `Error processing shop or grocery item: ${error.message}`
        );
        continue;
      }
    }

    const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
      ...shop,
      shopOrderSummary: {
        shopItems: shop.products.length,
        shopItemsTotal: shop.shopTotal.toFixed(2),
      },
    }));

    const orderSummary = {
      itemsTotal: order.itemsTotal,
      totalItems,
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
    };

    detailedOrders.push({
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      _id: order.id,
      customer: order.customer,
      shopDetails: shopDetails,
      orderTotal: orderTotal.toFixed(2),
      rider: order.driver ? order.driver.name : null,
      orderSummary,
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

//////////------Get one rider orders ------/////

// exports.getAllRiderOrders = catchAsync(async (req, res, next) => {
//   const orders = await Order.find({
//     driver: req.user.id,
//     // orderStatus: "accepted by rider",
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
//     const shopDetailsMap = new Map();
//     let orderTotal = 0;
//     let totalItems = 0;

//     for (const { shop, grocery, quantity } of order.products) {
//       totalItems += quantity;
//       console.log(shop, "this is the shop being searched from shop model");
//       try {
//         const fetchedShop = await Shop.findById(shop);
//         if (!fetchedShop) {
//           console.error(`Shop with ID ${shop} not found.`);
//           continue;
//         }

//         const fetchedGrocery = fetchedShop.groceries.id(grocery);
//         if (!fetchedGrocery) {
//           console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
//           continue;
//         }

//         const productDetail = {
//           productName: fetchedGrocery.productName,
//           category: fetchedGrocery.categoryName,
//           volume: fetchedGrocery.volume,
//           quantity: quantity,
//           productImages: fetchedGrocery.productImages,
//           price: fetchedGrocery.price,
//         };

//         const productTotal = fetchedGrocery.price * quantity;
//         orderTotal += productTotal;

//         if (!shopDetailsMap.has(shop.toString())) {
//           shopDetailsMap.set(shop.toString(), {
//             shopId: shop,
//             shopTitle: fetchedShop.shopTitle,
//             image: fetchedShop.image,
//             location: fetchedShop.location,
//             isOrderAccepted: fetchedShop.isOrderAccepted,
//             products: [],
//             shopTotal: 0,
//           });
//         }

//         const shopDetail = shopDetailsMap.get(shop.toString());
//         shopDetail.products.push(productDetail);
//         shopDetail.shopTotal += productTotal;
//       } catch (error) {
//         console.error(
//           `Error processing shop or grocery item: ${error.message}`
//         );
//         continue;
//       }
//     }

//     const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
//       ...shop,
//       shopOrderSummary: {
//         shopItems: shop.products.length,
//         shopItemsTotal: shop.shopTotal.toFixed(2),
//       },
//     }));

//     const orderSummary = {
//       itemsTotal: order.itemsTotal,
//       totalItems,
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
//     };

//     detailedOrders.push({
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       _id: order.id,
//       customer: order.customer,
//       shopDetails: shopDetails,
//       orderTotal: orderTotal.toFixed(2),
//       rider: order.driver ? order.driver.name : null,
//       orderSummary,
//     });
//   }

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Orders retrieved successfully",
//     data: detailedOrders,
//   });
// });
exports.getAllRiderOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({
    driver: req.user.id,
    // orderStatus: "accepted by rider",
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
    const shopDetailsMap = new Map();
    let orderTotal = 0;
    let totalItems = 0;

    for (const { shop, grocery, quantity } of order.products) {
      totalItems += quantity;
      try {
        const fetchedShop = await Shop.findById(shop);
        if (!fetchedShop) {
          console.error(`Shop with ID ${shop} not found.`);
          continue;
        }

        const fetchedGrocery = fetchedShop.groceries.id(grocery);
        if (!fetchedGrocery) {
          console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
          continue;
        }

        const productDetail = {
          productName: fetchedGrocery.productName,
          category: fetchedGrocery.categoryName,
          volume: fetchedGrocery.volume,
          quantity: quantity,
          productImages: fetchedGrocery.productImages,
          price: fetchedGrocery.price,
        };

        const productTotal = fetchedGrocery.price * quantity;
        orderTotal += productTotal;

        if (!shopDetailsMap.has(shop.toString())) {
          shopDetailsMap.set(shop.toString(), {
            shopId: shop,
            shopTitle: fetchedShop.shopTitle,
            image: fetchedShop.image,
            location: fetchedShop.location,
            isOrderAccepted: fetchedShop.isOrderAccepted,
            products: [],
            shopTotal: 0,
          });
        }

        const shopDetail = shopDetailsMap.get(shop.toString());
        shopDetail.products.push(productDetail);
        shopDetail.shopTotal += productTotal;
      } catch (error) {
        console.error(
          `Error processing shop or grocery item: ${error.message}`
        );
        continue;
      }
    }

    const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
      ...shop,
      shopOrderSummary: {
        shopItems: shop.products.length,
        shopItemsTotal: shop.shopTotal.toFixed(2),
      },
    }));

    const listOrderDetails = order.listItems
      .filter((item) => item.isAvailable)
      .map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: (item.quantity * item.price).toFixed(2),
      }));

    const orderSummary = {
      itemsTotal: order.itemsTotal,
      totalItems,
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
      listOrderDetails,
    };

    detailedOrders.push({
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      _id: order.id,
      customer: order.customer,
      shopDetails: shopDetails,
      orderTotal: orderTotal.toFixed(2),
      rider: order.driver ? order.driver.name : null,
      orderSummary,
    });
  }

  res.status(200).json({
    success: true,
    status: 200,
    message: "Orders retrieved successfully",
    data: detailedOrders,
  });
});

////////-----get all new orders with pending status------//////

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

/////-----get order details-----////

// exports.getOrderDetails = catchAsync(async (req, res, next) => {
//   const orderId = req.params.id;

//   const order = await Order.findById(orderId)
//     .populate("customer", "firstName lastName email image location")
//     .populate("driver", "name email location image");
//   const list = await List.findById(orderId).populate(
//     "customer",
//     "firstName lastName email image location"
//   );
//   if (!order || !list) {
//     return next(new AppError("Order not found", 404));
//   }

//   const shopDetailsMap = new Map();
//   let orderTotal = 0;
//   let totalItems = 0;

//   for (const { shop, grocery, quantity } of order.products) {
//     totalItems += quantity;
//     console.log(shop, "shop id being searched in shop model");
//     try {
//       const fetchedShop = await Shop.findById(shop);
//       if (!fetchedShop) {
//         console.error(`Shop with ID ${shop} not found.`);
//         continue;
//       }

//       const fetchedGrocery = fetchedShop.groceries.id(grocery);
//       if (!fetchedGrocery) {
//         console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
//         continue;
//       }

//       const productDetail = {
//         productName: fetchedGrocery.productName,
//         category: fetchedGrocery.categoryName,
//         volume: fetchedGrocery.volume,
//         quantity: quantity,
//         productImages: fetchedGrocery.productImages,
//         price: fetchedGrocery.price,
//       };

//       const productTotal = fetchedGrocery.price * quantity;
//       orderTotal += productTotal;

//       if (!shopDetailsMap.has(shop.toString())) {
//         shopDetailsMap.set(shop.toString(), {
//           shopId: shop,
//           shopTitle: fetchedShop.shopTitle,
//           image: fetchedShop.image,
//           location: fetchedShop.location,
//           isOrderAccepted: fetchedShop.isOrderAccepted,
//           products: [],
//           shopTotal: 0,
//         });
//       }

//       const shopDetail = shopDetailsMap.get(shop.toString());
//       shopDetail.products.push(productDetail);
//       shopDetail.shopTotal += productTotal;
//     } catch (error) {
//       console.error(`Error processing shop or grocery item: ${error.message}`);
//       continue;
//     }
//   }

//   const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
//     ...shop,
//     shopOrderSummary: {
//       shopItems: shop.products.length,
//       shopItemsTotal: shop.shopTotal.toFixed(2),
//     },
//   }));

//   const orderSummary = {
//     itemsTotal: order.itemsTotal,
//     totalItems,
//     serviceFee: order.serviceFee,
//     adminFee: order.adminFee,
//     totalPayment: order.totalPayment,
//     paymentStatus: order.paymentStatus,
//     deliveryFee: order.deliveryCharges,
//     deliveryTime: order.deliveryTime,
//     startLocation: order.startLocation,
//     endLocation: order.endLocation,
//     deliveryPaymentStatus: order.deliveryPaymentStatus,
//     shopAcceptedOrder: order.shopAcceptedOrder,
//     shopRejectedOrder: order.shopRejectedOrder,
//   };

//   // Process lists
//   for (const list of lists) {
//     const orderSummary = {
//       itemsTotal: list.total,
//       products: list.items,
//       orderNumber: list.listOrderNumber,
//       orderStatus: list.listStatus,
//       orderType: list.orderType,
//       // orderTotal: list.total,
//       startLocation: list.startLocation,
//       endLocation: list.endLocation,
//       deliveryPaymentStatus: list.deliveryPaymentStatus,
//     };
//     // const quantity = list.map()
//     // totalItems += list.quantity;
//     console.log(list, "before pusshing to the datra.....");

//     detailedOrders.push({
//       orderNumber: list.listOrderNumber,
//       orderType: list.orderType,
//       orderStatus: list.listStatus,
//       // totalItems,
//       _id: list._id,
//       customer: list.customer,
//       orderTotal: list.total,
//       rider: list.driver ? list.driver.name : null,
//       orderSummary,
//     });
//   }

//   res.status(200).json({
//     success: true,
//     status: 200,
//     message: "Order details retrieved successfully",
//     order: {
//       orderNumber: order.orderNumber,
//       orderStatus: order.orderStatus,
//       _id: order.id,
//       customer: order.customer,
//       shopDetailWithProduct: shopDetails,
//       orderTotal: orderTotal.toFixed(2),
//       rider: order.driver ? order.driver : null,
//       orderSummary,
//     },
//   });
// });

exports.getOrderDetails = catchAsync(async (req, res, next) => {
  const orderId = req.params.id;

  // Try to fetch the order by ID
  let order = await Order.findById(orderId)
    .populate("customer", "firstName lastName email image location")
    .populate("driver", "name email location image");

  let list = null;
  if (!order) {
    // If the order is not found, try to fetch it as a list
    list = await List.findById(orderId).populate(
      "customer",
      "firstName lastName email image location"
    );

    if (!list) {
      return next(new AppError("Order or List not found", 404));
    }
  }
  if (list) {
    const listOrderDetails = {
      orderNumber: list.listOrderNumber,
      orderStatus: list.listStatus,
      _id: list._id,
      customer: list.customer,
      listTitle: list.listTitle,
      rider: list.rider,
      // isRejected: list.isRejected,
      // isAccepted: list.isAccepted,
      endLocation: list.endLocation,
      requestedRiders: list.requestedRiders,
      riderRejectedList: list.riderRejectedList,
      // orderTotal:list,
      items: list.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        isAvailable: item.isAvailable,
      })),
    };

    return res.status(200).json({
      success: true,
      status: 200,
      message: "List details retrieved successfully",
      data: listOrderDetails,
    });
  }

  // If it's an order, format the response accordingly
  const shopDetailsMap = new Map();
  let orderTotal = 0;
  let totalItems = 0;

  for (const { shop, grocery, quantity } of order.products) {
    totalItems += quantity;
    try {
      const fetchedShop = await Shop.findById(shop);
      if (!fetchedShop) {
        console.error(`Shop with ID ${shop} not found.`);
        continue;
      }

      const fetchedGrocery = fetchedShop.groceries.id(grocery);
      if (!fetchedGrocery) {
        console.error(`Grocery with ID ${grocery} not found in shop ${shop}`);
        continue;
      }

      const productDetail = {
        productName: fetchedGrocery.productName,
        category: [
          {
            categoryName: fetchedGrocery.categoryName,
            categoryImage:
              "https://icon-library.com/images/default-profile-icon/default-profile-icon-6.jpg",
            _id: fetchedGrocery.category._id,
          },
        ],
        volume: fetchedGrocery.volume,
        quantity: quantity,
        productImages: fetchedGrocery.productImages,
        price: fetchedGrocery.price,
      };

      const productTotal = fetchedGrocery.price * quantity;
      orderTotal += productTotal;

      if (!shopDetailsMap.has(shop.toString())) {
        shopDetailsMap.set(shop.toString(), {
          shopId: shop,
          shopTitle: fetchedShop.shopTitle,
          image: fetchedShop.image,
          location: fetchedShop.location,
          isOrderAccepted: fetchedShop.isOrderAccepted,
          products: [],
          shopTotal: 0,
        });
      }

      const shopDetail = shopDetailsMap.get(shop.toString());
      shopDetail.products.push(productDetail);
      shopDetail.shopTotal += productTotal;
    } catch (error) {
      console.error(`Error processing shop or grocery item: ${error.message}`);
      continue;
    }
  }

  const shopDetails = [...shopDetailsMap.values()].map((shop) => ({
    ...shop,
    shopOrderSummary: {
      shopItems: shop.products.length,
      shopItemsTotal: shop.shopTotal.toFixed(2),
    },
  }));

  const orderSummary = {
    itemsTotal: order.itemsTotal,
    totalItems,
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
  };

  res.status(200).json({
    success: true,
    status: 200,
    message: "Order details retrieved successfully",
    data: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      _id: order.id,
      customer: order.customer,
      shopDetails: shopDetails,
      orderTotal: orderTotal.toFixed(2),
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
    order.isdeliveryInProgress = true;
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
// exports.acceptOrRejectOrderByOwner = catchAsync(async (req, res, next) => {
//   const { orderId, action } = req.body;

//   // Find the order by ID
//   const order = await Order.findById(orderId);
//   const shop = await Shop.findOne({ owner: req.user.id });
//   // const shop = await Shop.findOne({ owner: userId });

//   if (!order) {
//     return next(new AppError("Order not found", 404));
//   }

//   // //////Check if the order is still pending
//   if (order.orderStatus !== "pending") {
//     return next(new AppError("Order is not in pending state ", 400));
//   }

//   // Handle the action
//   if (action === "accept") {
//     order.orderStatus = "accepted by owner";
//     // order.isdeliveryInProgress = true;
//     shop.isOrderAccepted = true;
//     // order.driver = req.user.id;
//     await order.save();
//     await shop.save();

//     // Send a notification to the all riders about the new order
//     const allRiders = await User.find({ userType: "Rider" });
//     console.log(allRiders, "All riders");
//     // const FCMTokens = allRiders.map((rider) => rider.deviceToken);
//     // console.log(FCMTokens, "FCMToken of all riders");

//     // await SendNotificationMultiCast({
//     //   tokens: FCMTokens,
//     //   title: "New order on shop",
//     //   body: `Accept or reject the order ${order}`,
//     // });
//     return res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Order accepted and notifies to all riders",
//       data: order,
//     });
//   } else if (action === "reject") {
//     const customer = await User.findById(order.customer).populate(
//       "deviceToken"
//     );
//     // order.orderStatus = "rejected";
//     // await order.save();
//     shop.isOrderRejected = true;
//     await shop.save();
//     const FCMToken = customer.deviceToken;
//     console.log(customer, "here is the deviceToken of costumer  bhaya");
//     console.log(FCMToken, "here is the FCMToken of costume g");
//     // await SendNotification({
//     //   token: FCMToken,
//     //   title: "Your order is rejected by the owner ",
//     //   body: `Owner rejected the order ${order}`,
//     // });

//     return res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Order rejected by shop owner",
//     });
//   } else {
//     return next(new AppError("Invalid action, use 'accept' or 'reject'", 400));
//   }
// });

exports.acceptOrRejectOrderByOwner = catchAsync(async (req, res, next) => {
  const { orderId, action } = req.body;

  // Find the order by ID
  const order = await Order.findById(orderId);
  const shop = await Shop.findOne({ owner: req.user.id });

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // // Check if the order is still pending
  // if (order.orderStatus !== "pending") {
  //   return next(
  //     new AppError("Order is not in pending state or already accepted", 400)
  //   );
  // }

  // Handle the action
  if (action === "accept") {
    order.orderStatus = "accepted by owner";
    order.shopAcceptedOrder.push(shop._id);
    // shop.isOrderAccepted = true;
    await order.save();
    // await shop.save();

    // Send a notification to all riders about the new order
    const allRiders = await User.find({ userType: "Rider" });

    // Uncomment the notification sending logic if required
    // const FCMTokens = allRiders.map((rider) => rider.deviceToken);
    // await SendNotificationMultiCast({
    //   tokens: FCMTokens,
    //   title: "New order on shop",
    //   body: `Accept or reject the order ${order}`,
    // });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Order accepted and notified to all riders",
      data: order,
    });
  } else if (action === "reject") {
    // shop.isOrderRejected = true;
    order.shopRejectedOrder.push(shop._id);

    await order.save();
    // await shop.save();

    // Check if all shops for this order have rejected it
    const allShops = await Shop.find({
      _id: { $in: order.products.map((p) => p.shop) },
    });
    const allRejected = allShops.every((shop) => shop.isOrderRejected);

    if (allRejected) {
      order.orderStatus = "rejected";
      await order.save();
    }

    const customer = await User.findById(order.customer).populate(
      "deviceToken"
    );
    const FCMToken = customer.deviceToken;

    // Uncomment the notification sending logic if required
    // await SendNotification({
    //   token: FCMToken,
    //   title: "Your order is rejected by the owner",
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
