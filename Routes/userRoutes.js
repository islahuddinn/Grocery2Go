const express = require("express");
const userControler = require("../Controllers/userController");
const restaurantController = require("../Controllers/restaurantController");
const authController = require("../Controllers/authController");
const catchAsync = require("../Utils/catchAsync");
const fileUpload = require("express-fileupload");
const { uploadFile } = require("../Utils/s3-uploader");
// const pushNotificationController = require("../controllers/push-notificationController");
const router = express.Router();
router.post(
  "/bucket-upload",
  fileUpload({}),
  catchAsync(async (req, res) => {
    const file = req.files.file;
    const url = await uploadFile(file);
    return res.send({ url });
  })
);

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
router.get("/mynotifications", userControler.mynotifications);
router.post("/logout", authController.logout);
// router.post(
//   "/send-notification",
//   pushNotificationController.sendPushNotification
// );
router.get("/rewards-points", userControler.getUserRewardPoints);
router.get("/wallet-ballance", userControler.getWalletBalance);

router.get("/me", userControler.getMe, userControler.getUser);
router.patch(
  "/updateProfile",
  authController.restrictTo("User"),
  userControler.updateMe
);
router.patch(
  "/update-business-profile",
  authController.restrictTo("Owner"),

  restaurantController.updateBusinessProfile
);
// router.patch("/updateMe", userControler.updateMe);
// router.patch("/updateProfile", userControler.updateUserProfile);
// router.delete("/deleteMe", userControler.deleteMe); its not functional
router.route("/getAllUsers").get(userControler.getAllUsers);

// router.use(authController.restrictTo("admin"));
// router.route("/").post(userControler.createUser);

router
  .route("/:id")
  .get(userControler.getUser)
  .patch(userControler.updateUser)
  .delete(userControler.deleteUser);
// .post(userControler.deleteUser);

module.exports = router;
