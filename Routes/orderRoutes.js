const express = require("express");
const authController = require("../Controllers/authController");
const orderController = require("../Controllers/orderController");
const router = express.Router();

router.use(authController.protect);
// router.post("/create", orderController.createOrder);
router.get("/get-user-orders", orderController.getAllOrdersByUser);
// router.get("/get-shop-orders", orderController.getAllOrdersByShop);
// router.get("/get-all-orders", orderController.get);
///on rider side new orders
router.get("/get-shop-orders", orderController.getAllNewAcceptedByOwnerOrders); ///// all new orders use this api on shop new order side
router.get(
  "/get-shop-accepted-orders",
  orderController.getAllAcceptedByShopOrders
); ///// all orders for my shop
// router.get(
//   "/get-all-rider-accepted-orders",
//   orderController.getAllAcceptedByRiderOrders
// ); //// all orders accepted by the all riders,
router.get("/get-rider-orders", orderController.getAllAcceptedByOwnerOrders); /// use this api to show orders
router.get("/get-rider-accepted-orders", orderController.getAllRiderOrders); // rider accepted orders my orders
router.get("/order-details/:id", orderController.getOrderDetails);
// router.get("/shop-stats", orderController.getOrderDetails);
router.post(
  "/accept-reject-order-owner",
  authController.restrictTo("owner"),
  orderController.acceptOrRejectOrderByOwner
);
router.post(
  "/accept-reject-order-rider",
  authController.restrictTo("Rider"),
  orderController.acceptOrRejectOrderByRider
);
router.patch("/change-order-status", orderController.updateOrderStatus);
router.post("/ready-for-pickup/:id", orderController.readyForPickup);
router.post("/mark-shop-order-pickedup", orderController.markOrderAsPickedUp);
router.post(
  "/mark-shop-order-ready-for-pickup",
  orderController.markOrderAsReadyForPickedUp
);

// router.get("/get-all-favorite-products", shopController.getAllFavoriteProducts);
// router.post("/mark-favorite-unfavorite", shopController.toggleProductFavorite);
// router.get("/", shopController.getAllProduct);
// router
//   .route("/:id")
//   .get(shopController.getOneProduct)
//   .patch(shopController.updateProduct)
//   .delete(shopController.deleteProduct);

module.exports = router;
