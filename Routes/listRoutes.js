const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const listController = require("../Controllers/listController");
const router = express.Router();

router.use(authController.protect);
router.post("/create-list", listController.addProductsToList);
router.patch("/edit-product", listController.editProductInList);
router.patch("/delete-product", listController.deleteProductFromList);
router.get("/get-all-riders", listController.getAllRiders);
router.get("/select-rider", listController.getAllRiders);
router.get("/get-rider-details/:id", listController.getRiderDetails);
router
  .route("/:id")
  .get(listController.getOneList)
  .patch(listController.updateList);
//   .delete(listController.deleteList);

module.exports = router;
