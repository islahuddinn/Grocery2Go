const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const riderController = require("../Controllers/riderController");
const router = express.Router();

router.use(authController.protect);
router.get("/online-riders", riderController.getAllOnlineRiders);
router.post("/online-offline-rider", riderController.updateRiderOnlineStatus);
router.get("/rider-stats", riderController.getRiderStatistics);
router.post("/search-shop", riderController.searchShopByTitle);
router.get(
  "/get-completed orders-rider/:id",
  riderController.getCompletedOrdersByRider
);
// router.get("/", shopController.getAllProduct);
// router
//   .route("/:id")
//   .get(shopController.getOneProduct)
//   .patch(shopController.updateProduct)
//   .delete(shopController.deleteProduct);

module.exports = router;
