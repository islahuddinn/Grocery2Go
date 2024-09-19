const FAQ = require("../Models/faqsModel");
const catchAsync = require("../Utils/catchAsync");
const AppError = require("../Utils/appError");
const Factory = require("../Controllers/handleFactory");

/// Controller function to create a FAQ
exports.createFAQ = catchAsync(async (req, res, next) => {
  const { question, answer, questionType } = req.body;

  if (!question || !answer || !questionType) {
    return next(
      new AppError(
        "All fields are required: question, answer, and questionType",
        400
      )
    );
  }

  const faq = await FAQ.create({
    question,
    answer,
    questionType,
  });

  res.status(201).json({
    success: true,
    status: 201,
    data: {
      faq,
    },
  });
});

/// Get FAQ by type

exports.getFAQsByQuestionType = catchAsync(async (req, res, next) => {
  const { questionType } = req.query;

  if (!questionType) {
    return next(new AppError("Question type is required", 400));
  }

  const faqs = await FAQ.find({ questionType });

  if (!faqs.length) {
    return next(new AppError("No FAQs found for this question type", 200));
  }

  res.status(200).json({
    success: true,
    status: 200,
    data: {
      faqs,
    },
  });
});
///Search Faqs

// exports.searchFAQsByQuestion = catchAsync(async (req, res, next) => {
//   const { keywords } = req.quary;
//   console.log(keywords, "here are the keywords");

//   if (!query) {
//     return next(new AppError("Search keywords are required", 400));
//   }

//   // Use regular expression to search for the query in the question field
//   const faqs = await FAQ.find({
//     question: { $regex: keywords, $options: "i" }, // 'i' for case-insensitive search
//   });

//   if (!faqs.length) {
//     return next(new AppError("No FAQs found for search keywords", 200));
//   }

//   res.status(200).json({
//     success: true,
//     status: 200,
//     data: {
//       faqs,
//     },
//   });
// });

exports.searchFAQsByQuestion = catchAsync(async (req, res, next) => {
  const { keywords } = req.query;

  if (!keywords) {
    return next(new AppError("Search keywords are required", 400));
  }

  // Split keywords by spaces
  const keywordArray = keywords.split(" ");
  const totalKeywords = keywordArray.length;

  // Find FAQs where at least 60% of the keywords match the question
  const faqs = await FAQ.find({});

  const matchingFAQs = faqs.filter((faq) => {
    const questionWords = faq.question.split(" ");
    const matchingWords = keywordArray.filter((keyword) =>
      questionWords.some((word) =>
        word.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    // Return only FAQs where at least 60% of keywords match
    return matchingWords.length / totalKeywords >= 0.6;
  });

  if (!matchingFAQs.length) {
    return next(
      new AppError("No FAQs found matching the search criteria", 200)
    );
  }

  res.status(200).json({
    success: true,
    status: 200,
    data: {
      faqs: matchingFAQs,
    },
  });
});
exports.getAllFAQ = Factory.getAll(FAQ);
exports.getOneFAQ = Factory.getOne(FAQ);
exports.updateFAQ = Factory.updateOne(FAQ);
exports.deleteFAQ = Factory.deleteOne(FAQ);
