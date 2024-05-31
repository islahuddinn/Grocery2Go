const loginChecks = (user) => {
  // console.log("ROLE:", currentrole, "USER:", user);
  if (!user.verified) {
    return "email-unverified";
  } else if (user.userType === "Owner" && !user.isProfileCompleted) {
    return "Business-profile-setup-pending";
  } else if (!user.firstName) {
    return "User-profile-setup-pending";
  } else {
    return "login-granted";
  }
};

module.exports = {
  loginChecks,
};
