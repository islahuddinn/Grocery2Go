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
    shopName: {
      type: String,
    },
    openingTime: {
      type: String,
    },
    closingTime: {
      type: String,
    },
    // bankName: {
    //   type: String,
    // },
    // accountNumber: {
    //   type: String,
    //   // unique: true,
    // },
    vehiclePermit: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: [true, "Enter a valid email"],
      validate: [validator.isEmail, "Please provide a valid email"],
    },
    contact: {
      type: String,
    },
    location: {
      type: {
        type: String,
        default: "Point",
      },
      country: String,
      coordinates: { type: [Number], default: [0, 0] },
      address: String,
    },

    image: {
      type: String,
      default:
        "https://icon-library.com/images/default-profile-icon/default-profile-icon-6.jpg",
    },
    userType: {
      type: String,
      enum: ["Customer", "Owner", "Rider", "Admin"],
      default: "Customer",
      required: [true, "Enter a valid user type"],
    },
    password: {
      type: String,
      required: [true, "Password is a required field"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    confirmPassword: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    isNotification: {
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
    isOnline: {
      type: Boolean,
      default: false,
    },
    shopId: {
      type: String,
    },
    bankAccountInfo: {
      bankAccountId: {
        type: String,
      },
      isOnboardingCompleted: {
        type: Boolean,
        default: false,
      },
    },
    country: String,
    shopEarnings: {
      type: Number,
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
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.confirmPassword = undefined;
  next();
});

userSchema.methods.correctPassword = async function (
  passwordByUser,
  passwordInDb
) {
  return await bcrypt.compare(passwordByUser, passwordInDb);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  this.find({ active: true });
  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
