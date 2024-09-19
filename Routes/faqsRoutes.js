const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const faqsController = require("../Controllers/faqsController");
const router = express.Router();

router.post(
  "/create",
  authController.protect,
  //   authController.restrictTo("admin"),
  faqsController.createFAQ
);

router.get("/", faqsController.getAllFAQ);
router.get("/search-faqs", faqsController.searchFAQsByQuestion);
router.get("/faqs-by-type", faqsController.getFAQsByQuestionType);
router
  .route("/:id")
  .get(faqsController.getOneFAQ)
  .patch(
    authController.protect,
    // authController.restrictTo("admin"),
    faqsController.updateFAQ
  )
  .delete(
    authController.protect,
    // authController.restrictTo("admin"),
    faqsController.deleteFAQ
  );

module.exports = router;
