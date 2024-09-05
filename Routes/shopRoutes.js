const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const shopController = require("../Controllers/shopController");
const router = express.Router();

router.use(authController.protect);
router.post("/create", shopController.createShop);
router.get("/get-all-favorite-shop", shopController.getAllFavoriteShops);
router.post("/mark-favorite-unfavorite/:id", shopController.toggleShopFavorite);

router.get("/getAllShop", shopController.getAllShop);
router.get("/get-nearby-shops", shopController.getNearbyShops);
router.get("/all-shops-groceries", shopController.getRandomGroceries);
router.get("/shop-stats", shopController.getShopOrderStats);

router
  .route("/:id")
  .get(shopController.getShop)
  .patch(shopController.updateShop)
  .delete(shopController.deleteShop);

module.exports = router;
