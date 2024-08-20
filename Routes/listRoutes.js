const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const listController = require("../Controllers/listController");
const router = express.Router();

router.use(authController.protect);
router.post("/create-list", listController.addProductsToList);
router.patch("/edit-product", listController.editProductInList);
router.patch("/delete-product", listController.deleteProductFromList);
router.get("/", listController.getAllLists);
router.get("/get-all-user-lists", listController.getUserLists);
router.get("/get-all-riders", listController.getAllRiders);
router.get("/get-rider-details/:id", listController.getRiderDetails);
router.post("/request-rider", listController.requestRider);
router.get("/get-one-order-details/:id", listController.getOneOrder);
router.post("/send-list-bill", listController.sendListBill);
router.post("/add-tip-to-rider", listController.addTipToRider);
router.post("/pay-delivery-charges", listController.payDeliveryCharges);
router.post(
  "/accept-reject-list-order",
  //   authController.restrictTo("Rider"),
  listController.acceptOrRejectListByRider
);
router.patch("/buying-grocery", listController.updateListItemAvailability);
router
  .route("/:id")
  .get(listController.getOneList)
  .patch(listController.updateList)
  .delete(listController.deleteList);

module.exports = router;
