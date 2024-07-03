const express = require("express");
const userController = require("../Controllers/userController");
const authController = require("../Controllers/authController");
const { createBankAccount } = require("../Utils/stripe");
const catchAsync = require("../Utils/catchAsync");
// const fileUpload = require("express-fileupload");
// const { uploadFile } = require("../Utils/s3-uploader");
// const pushNotificationController = require("../controllers/push-notificationController");
const router = express.Router();
// router.post(
//   "/bucket-upload",
//   fileUpload({}),
//   catchAsync(async (req, res) => {
//     const file = req.files.file;
//     const url = await uploadFile(file);
//     return res.send({ url });
//   })
// );

router.post("/signup", authController.signup);
router.post("/socialLogin", authController.socialLogin);
router.post("/guestLogin", authController.signup);
router.post("/verify", authController.verifyEmail);
router.post("/login", authController.login);
router.post("/sendOTP", authController.sendOTP);
router.post("/verifyOTP", authController.verifyOtp);
router.post("/refresh/:token", authController.refresh);
router.post("/forgetPassword", authController.forgotPassword);
router.patch("/resetPassword", authController.resetPassword);
router.post(
  "/verifyOTPResetPassword",
  authController.verifyOtpForResetPassword
);
// protecting all routes ussing protect midleware
router.use(authController.protect);
router.patch("/updateMyPassword", authController.updatePassword);
router.get("/mynotifications", userController.mynotifications);
router.post("/logout", authController.logout);
router.get("/stripe/add-bank", userController.addBankAccount);
router.get("/stripe/verify-onboarding", userController.verifyStripeOnboarding);
router.get("/stripe/get-onboarding-link", userController.getLoginLink);
router.get("/stripe/get-account-balance", userController.getAccountBalance);
router.get("/stripe/get-transactions", userController.getTransactions);
// router.post(
//   "/send-notification",
//   pushNotificationController.sendPushNotification
// );

router.get("/me", userController.getMe, userController.getUser);
router.patch(
  "/update-user-profile",
  authController.restrictTo("Customer"),
  userController.updateMe
);
router.patch(
  "/update-owner-profile",
  authController.restrictTo("Owner"),
  userController.updateMe
);
router.patch(
  "/update-rider-profile",
  authController.restrictTo("Rider"),
  userController.updateMe
);
router.route("/getAllUsers").get(userController.getAllUsers);

// router.use(authController.restrictTo("admin"));
// router.route("/").post(userControler.createUser);

router
  .route("/:id")
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
