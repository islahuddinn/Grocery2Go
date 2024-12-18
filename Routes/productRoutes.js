const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const shopController = require("../Controllers/shopController");
const router = express.Router();

router.use(authController.protect);
router.post("/create", shopController.addProduct);
router.get("/get-all-favorite-products", shopController.getAllFavoriteProducts);
router.get("/all-categories", shopController.getAllCategories);

router.post(
  "/mark-favorite-unfavorite/:id",
  shopController.toggleProductFavorite
);
router.get("/", shopController.getAllProduct);
router.get("/get-shop-products", shopController.getShopProducts);
router.get("/get-product-details/:id", shopController.getProductDetail);
router.patch("/update-product", shopController.updateProductInShop);
router.delete("/delete-product/:id", shopController.deleteProductFromShop);
// router
//   .route("/:id")
// .get(shopController.getOneProduct)
// .patch(shopController.updateProduct);
// .delete(shopController.deleteProduct);

module.exports = router;
