const loginChecks = (user) => {
  // console.log("ROLE:", currentrole, "USER:", user);
  if (!user.verified) {
    return "email-unverified";
  } else if (
    (user.userType === "Owner" && !user.isProfileCompleted) ||
    !user.bankAccountInfo.isOnboardingCompleted
  ) {
    return "Owner-profile-setup-pending";
  } else if (user.userType === "Customer" && !user.isProfileCompleted) {
    return "Customer-profile-setup-pending";
  } else if (
    (user.userType === "Rider" && !user.isProfileCompleted) ||
    !user.bankAccountInfo.isOnboardingCompleted
  ) {
    return "Rider-profile-setup-pending";
  } else {
    return "login-granted";
  }
};

module.exports = {
  loginChecks,
};
