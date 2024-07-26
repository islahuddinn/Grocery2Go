const express = require("express");
const authController = require("../Controllers/authController");
const orderController = require("../Controllers/orderController");
const router = express.Router();

router.use(authController.protect);
// router.post("/create", orderController.createOrder);
router.get("/get-user-orders", orderController.getAllOrdersByUser);
router.get("/get-shop-orders", orderController.getAllOrdersByShop);
// router.get("/get-all-orders", orderController.get);
router.get("/get-rider-orders", orderController.getAllAcceptedByOwnerOrders);
router.get(
  "/get-shop-accepted-orders",
  orderController.getAllNewAcceptedByOwnerOrders
); ///// all owner accepted orders use this api on shop
router.get(
  "/get-rider-accepted-orders",
  orderController.getAllAcceptedByRiderOrders
);
router.get("/get-rider-accepted-orders", orderController.getAllRiderOrders); // rider accepted orders my orders
router.get("/order-details/:id", orderController.getOrderDetails);
// router.get("/shop-stats", orderController.getOrderDetails);
router.post(
  "/accept-reject-order-owner",
  //   authController.restrictTo("owner"),
  orderController.acceptOrRejectOrderByOwner
);
router.post(
  "/accept-reject-order-rider",
  //   authController.restrictTo("Rider"),
  orderController.acceptOrRejectOrderByRider
);
router.post("/ready-for-pickup/:id", orderController.readyForPickup);

// router.get("/get-all-favorite-products", shopController.getAllFavoriteProducts);
// router.post("/mark-favorite-unfavorite", shopController.toggleProductFavorite);
// router.get("/", shopController.getAllProduct);
// router
//   .route("/:id")
//   .get(shopController.getOneProduct)
//   .patch(shopController.updateProduct)
//   .delete(shopController.deleteProduct);

module.exports = router;
