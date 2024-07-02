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
const riderRoutes = require("./riderRoutes");
// const reviewRoutes = require("./reviewRoutes");

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
  router.use("/rider", riderRoutes);
  // router.use("/reviews", reviewRoutes);

  return router;
};
module.exports = setupRoutesV1;
