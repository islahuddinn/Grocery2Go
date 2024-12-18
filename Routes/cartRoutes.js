const express = require("express");
const authController = require("../Controllers/authController");
const cartController = require("../Controllers/cartController");
const router = express.Router();

router.use(authController.protect);
router.post("/add-to-cart", cartController.addToCart);
router.post("/remove-cart-product", cartController.removeFromCart);
router.get("/get-cart-products", cartController.getCart);
router.patch("/update-cart-products", cartController.updateCart);
router.post("/check-out-cart", cartController.checkout);
router.post("/verify-payment", cartController.verifyPaymentAndCreateOrder);
router
  .route("/:id")
  //   .patch(cartController.updateCart)
  .delete(cartController.deleteCart);

module.exports = router;
