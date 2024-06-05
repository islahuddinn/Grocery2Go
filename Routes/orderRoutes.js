const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const shopController = require("../Controllers/shopController");
const router = express.Router();

router.use(authController.protect);
router.post("/create", shopController.addProduct);
router.get("/get-all-favorite-products", shopController.getAllFavoriteProducts);
router.post("/mark-favorite-unfavorite", shopController.toggleProductFavorite);
router.get("/", shopController.getAllProduct);
router
  .route("/:id")
  .get(shopController.getOneProduct)
  .patch(shopController.updateProduct)
  .delete(shopController.deleteProduct);

module.exports = router;
