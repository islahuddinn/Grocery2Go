const express = require("express");
const userRoutes = require("./userRoutes");
const privacyRoutes = require("./privacyPolicyRoutes");
const termsandconditionRoutes = require("./termsAndConditionRoutes");
const subscriptionRoutes = require("./subscriptionRoutes");
const shopRoutes = require("./shopRoutes");
const productRoutes = require("./productRoutes");
const cartRoutes = require("./cartRoutes");
const listRoutes = require("./listRoutes");
const orderRoutes = require("./orderRoutes");

const setupRoutesV1 = () => {
  const router = express.Router();
  router.use("/user", userRoutes);
  router.use("/privacy", privacyRoutes);
  router.use("/termsandcondition", termsandconditionRoutes);
  router.use("/subscription", subscriptionRoutes);
  router.use("/shop", shopRoutes);
  router.use("/product", productRoutes);
  router.use("/cart", cartRoutes);
  router.use("/list", listRoutes);
  router.use("/order", orderRoutes);

  return router;
};
module.exports = setupRoutesV1;
