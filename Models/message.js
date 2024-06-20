var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var MessageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", index: true },
    receiver: { type: Schema.Types.ObjectId, ref: "User", index: true },
    message: { type: String, required: true },
    messageTime: String,
    messageImage: String,
    messageVoice: String,
    seen: { type: Boolean, default: false },
    type: {
      type: String,
      required: true,
      enum: ["text", "audio", "photo", "video"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", MessageSchema);
