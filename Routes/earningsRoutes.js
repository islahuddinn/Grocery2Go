const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const earningsController = require("../Controllers/earningsController");
const router = express.Router();

router.use(authController.protect);
router.get(
  "/shop-earnings-history/:id",
  earningsController.getShopEarningsHistory
);
router.get("/all-shops-earnings", earningsController.getAllShopEarnings);
router.get(
  "/rider-earnings-history/:id",
  earningsController.getRiderEarningsHistory
);
router.get("/all-riders-earnings", earningsController.getAllRiderEarnings);
router
  .route("/get-one-shop-earnings/:id")
  .get(earningsController.getOneShopEarnings);
router.route("/delete-shop-earnings/:id").delete(
  // authController.restrictTo("admin"),
  earningsController.deleteShopEarnings
);
router
  .route("/get-one-rider-earnings/:id")
  .get(earningsController.getOneRiderEarnings);
router.route("/delete-rider-earnings/:id").delete(
  // authController.restrictTo("admin"),
  earningsController.deleteRiderEarnings
);

module.exports = router;
