const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const ratingController = require("../Controllers/ratingController");
const router = express.Router();

router.use(authController.protect);
router.post("/create", ratingController.createRating);
router.patch("/update-ratings/:id", ratingController.updateRating);
router.get("/get-rating-for-user/:id", ratingController.getRatingsForUser);
router.get(
  "/get-average-rating-for-user/:id",
  ratingController.getAverageRatingForUser
);
router.delete("/delete-rating/:id", ratingController.deleteRating);

module.exports = router;
