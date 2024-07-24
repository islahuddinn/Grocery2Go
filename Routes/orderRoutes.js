const express = require("express");
const authController = require("../Controllers/authController");
const orderController = require("../Controllers/orderController");
const router = express.Router();

router.use(authController.protect);
// router.post("/create", orderController.createOrder);
router.get("/get-user-orders", orderController.getUserOrders);
router.get("/get-all-orders", orderController.getAllShopOrders);
// router.get("/get-shop-orders/:id", orderController.getAllShopOrders);
// router.get("/get-rider-orders/:id", orderController.getAllRiderOrders);
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

// router.get("/get-all-favorite-products", shopController.getAllFavoriteProducts);
// router.post("/mark-favorite-unfavorite", shopController.toggleProductFavorite);
// router.get("/", shopController.getAllProduct);
// router
//   .route("/:id")
//   .get(shopController.getOneProduct)
//   .patch(shopController.updateProduct)
//   .delete(shopController.deleteProduct);

module.exports = router;
