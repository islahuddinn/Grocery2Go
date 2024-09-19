const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "FAQ must have a question"],
      trim: true,
    },
    answer: {
      type: String,
      required: [true, "FAQ must have an answer"],
      trim: true,
    },
    questionType: {
      type: String,
      required: [true, "FAQ must have a question type"],
      enum: {
        values: [
          "general",
          "account",
          "technical",
          "billing",
          "shipping",
          "returns",
          "other",
        ],
        message:
          "Question type is either: account, technical, billing, shipping, returns, or other",
      },
      default: "general",
    },
  },
  {
    timestamps: true,
  }
);

const FAQ = mongoose.model("FAQ", faqSchema);

module.exports = FAQ;
