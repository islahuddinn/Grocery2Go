// const { Stripe } = require("stripe");
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// module.exports = { stripe };

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const createBankAccount = async (user) => {
  try {
    const countryCode = {
      Australia: "AU",
      Austria: "AT",
      Belgium: "BE",
      Brazil: "BR",
      Bulgaria: "BG",
      Canada: "CA",
      Croatia: "HR",
      Cyprus: "CY",
      "Czech Republic": "CZ",
      Denmark: "DK",
      Estonia: "EE",
      Finland: "FI",
      France: "FR",
      Germany: "DE",
      Greece: "GR",
      "Hong Kong": "HK",
      Hungary: "HU",
      Ireland: "IE",
      Italy: "IT",
      Japan: "JP",
      Latvia: "LV",
      Lithuania: "LT",
      Luxembourg: "LU",
      Malta: "MT",
      Mexico: "MX",
      Netherlands: "NL",
      "New Zealand": "NZ",
      Norway: "NO",
      Poland: "PL",
      Portugal: "PT",
      Romania: "RO",
      Singapore: "SG",
      Slovakia: "SK",
      Slovenia: "SI",
      Spain: "ES",
      Sweden: "SE",
      Switzerland: "CH",
      Thailand: "TH",
      "United Kingdom": "GB",
      "United States": "US",
    };
    if (!user.bankAccountInfo.bankAccountId) {
      console.log("BANK ACCOUNT ID NOT FOUND. CREATING BANK ACCOUNT");
      const account = await stripe.accounts.create({
        country: countryCode[user.addressInfo.country],
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
      });
      if (!account) {
        console.log("ERROR WHILE CREATING ACCOUNT");
      }
      console.log("BANK ACCOUNT AFTER CREATION IS:", account);
      user.bankAccountInfo.bankAccountId = account.id;
      await user.save();
    } else {
      console.log(
        "BANK ACCOUNT ID FOUND. PROCEEDING TO ACCOUNT LINK GENERATION"
      );
    }
    const accountLink = await stripe.accountLinks.create({
      account: `${user.bankAccountInfo.bankAccountId}`,
      refresh_url: `http://localhost:3000/api/v1/users/stripe/add-bank`,
      return_url: `http://localhost:3000/api/v1/users/stripe/verify-onboarding`,
      type: "account_onboarding",
    });
    if (!accountLink) {
      console.log("ERROR WHILE GENERATING ACCOUNT LINK");
    }
    console.log("ACCOUNT LINK AFTER CREATION IS:", accountLink);
    return accountLink;
  } catch (error) {
    console.log("ERROR WHILE CREATING BANK ACCOUNTL", error);
  }
};
const verifyOnboarding = async (user) => {
  try {
    const bankAccount = await stripe.account.retrieve(
      user.bankAccountInfo.bankAccountId
    );
    if (!bankAccount) {
      console.log("COULD NOT RETRIEVE BANK ACCOUNT");
    }
    console.log("BANK ACCOUNT FOUND:", bankAccount);
    if (bankAccount.details_submitted) {
      user.bankAccountInfo.isOnboardingCompleted = true;
      await user.save();
      const loginLink = await stripe.accounts.createLoginLink(
        user.bankAccountInfo.bankAccountId
      );
      console.log("BANK ACCOUNT VERIFIED. LOGIN LINK IS:", loginLink);
      return loginLink;
    }
  } catch (error) {
    console.log("ERROR WHILE VERIFIYING ONBOARDING:", error);
  }
};
const generateLoginLink = async (user) => {
  try {
    const loginLink = await stripe.accounts.createLoginLink(
      user.bankAccountInfo.bankAccountId
    );
    return loginLink;
  } catch (error) {
    console.log("ERROR WHILE GETTING LOGIN LINK:", error);
  }
};
const createStripeCustomer = async (user) => {
  try {
    const stripeCustomer = await stripe.customers.create({
      email: user.email,
      name: user.name,
    });
    return stripeCustomer.id;
  } catch (err) {
    console.log("ERROR WHILE CREATING STRIPE CUSTOMER:", err);
  }
};
const createPaymentIntent = async (user, total, customerId, orderId) => {
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: total * 100,
      currency: "usd",
      customer: customerId,
      metadata: {
        userId: String(user._id),
        orderId: String(orderId),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return paymentIntent;
  } catch (error) {
    console.log("ERROR WHILE CREATING INTENT:", error);
  }
};
const retrievePaymentIntent = async (paymentIntentId) => {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (!paymentIntent) {
    return false;
  }
  return paymentIntent;
};
const createRefund = async (refundAmount, paymentIntentId) => {
  try {
    console.log("REFUNDING AMOUNT!!!!");
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundAmount * 100,
    });
    return true;
  } catch (error) {
    console.log("Error while creating refund:", error);
    return false;
  }
};
const createTransfer = async (transferAmount, transferTo, orderId) => {
  try {
    console.log("CREATING TRANSFER!!!!");
    const transfer = await stripe.transfers.create({
      amount: transferAmount * 100,
      currency: "usd",
      destination: transferTo,
      transfer_group: `${orderId}`,
    });
    return true;
  } catch (error) {
    console.log("ERROR WHILE CREATING TRANSFER", error);
    return false;
  }
};
const retrieveBalance = async (accountId) => {
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId,
    });
    return balance;
  } catch (error) {
    console.log("ERROR WHILE FETCHING ACCOUNT BALANCE:", error);
    return false;
  }
};
const retrieveTransactions = async (customerId) => {
  try {
    console.log("CUSTOMER ID IS:", customerId);
    console.log("FETCHING TRANSACTIONS");
    const transactions = await stripe.customers.listBalanceTransactions(
      `${customerId}`
    );
    return transactions;
  } catch (error) {
    console.log("COULD NOT FETCH TRANSACTIONS:", error);
    return false;
  }
};
module.exports = {
  createBankAccount,
  verifyOnboarding,
  generateLoginLink,
  createStripeCustomer,
  createPaymentIntent,
  retrievePaymentIntent,
  createRefund,
  createTransfer,
  retrieveBalance,
  retrieveTransactions,
};
