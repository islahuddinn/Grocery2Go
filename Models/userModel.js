const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    fullName: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      lowerCase: true,
      required: [true, "Enter a valid email"],
      validate: [validator.isEmail, "please provide a valid email"],
    },
    contact: {
      type: Number,
    },
    Address: {
      type: String,
    },
    location: {
      type: point,
    },
    image: {
      type: String,
      default:
        "https://icon-library.com/images/default-profile-icon/default-profile-icon-6.jpg",
    },
    userType: {
      type: String,
      enum: ["Customer", "Owner", "Driver", "Admin"],
      message: ["enter vallid role"],
      default: "Customer",
      required: [true, "Enter a valid user type"],
    },
    password: {
      type: String,
      required: [true, "Password is a required field"],
      minlength: [8, "Password must be of atleast 8 Charactors"],
      select: false,
    },
    confirmPassword: {
      type: String,
      minlength: [8, "Password must be of atleast 8 Charactors"],
      select: false,
    },
    subscriptionType: {
      type: String,
      enum: ["free", "monthly", "yearly"],
      default: "free",
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },

    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
    otp: {
      type: Number,
    },
    otpExpires: Date,
    deviceToken: String,
    verified: {
      type: Boolean,
      default: false,
    },
    customerId: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
userSchema.index({ location: "2dsphere" });
userSchema.pre("save", async function (next) {
  //only run this function if password id actually modified
  if (!this.isModified("password")) return next();
  // Hash the password with cost
  this.password = await bcrypt.hash(this.password, 12);
  // remove(stop) the confirmPassword to store in db. require means necessary to input not to save in db.
  this.confirmPassword = undefined;
  next();
});
// password Tester
userSchema.methods.correctPassword = async function (
  passwordByUser,
  passwordInDb
) {
  return await bcrypt.compare(passwordByUser, passwordInDb);
};

// ========method to protect routes verifies all about token

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    console.log(changedTimestamp, JWTTimestamp);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// update "passwordChangedAt value in DB whenever we update password "
userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000; //here -1000 mili seconds is to make sure that it will not creat any problem in login as some times that gets this
  next();
});

// Middleware to only get active=true users
userSchema.pre(/^find/, function (next) {
  // here "this" points to the current property`
  this.find({ active: true });
  next();
});
const User = mongoose.model("User", userSchema);
module.exports = User;
