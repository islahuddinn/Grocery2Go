var mongoose = require("mongoose");
const { String } = require("mongoose/lib/schema/index");
var Schema = mongoose.Schema;

var MessageSchema = new Schema(
  {
    messageType: {
      type: String,
      enum: ["single", "group", "broadcast"],
      default: "single",
    },
    chatId: { type: Schema.Types.ObjectId, ref: "Chat", index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", index: true },
    receiver: { type: Schema.Types.ObjectId, ref: "User", index: true },
    message: { type: String, required: true },
    messageTime: String,
    audioLength: String,
    seen: { type: Boolean, default: false },
    seenBy: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    type: {
      type: String,
      required: true,
      enum: ["text", "audio", "photo", "video", "alert", "post"],
    },
    location: {
      // Geo JSON Object
      type: {
        type: String,
        default: "Point",
      },
      coordinates: { type: [Number], default: [0.0, 0.0] },
      address: String,
      description: String,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      index: true,
    },
  },
  { timestamps: true }
);

MessageSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Message", MessageSchema);
