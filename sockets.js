const lambdaQuery = require("./Utils/queryLambda");
const TxQuery = require("./txQuery");
const { models, inferModels, schemas } = TxQuery.internals;
const rideRequest = require("./Controllers/rideRequestController");
const io = require("socket.io")();
const { Req, Res } = require("./requester");
const Message = require("./Models/Message");
const User = require("./Models/userModel");

const OnlineUser = require("./Models/OnlineUser");

const queries = {};
const lastResult = {};
let watched = false;

const process = (evName, socket, io, f) => (data) => {
  const res = new Res(socket, evName, io);
  const req = new Req(socket, data, res);
  if (req?.body?.user) req.user = req.body.user;
  const final = f(req, res);
  final
    ?.then((_) => _)
    ?.catch((e) => res.error(`${e.message}\n\n${JSON.stringify(e.stack)}`));
};

const client = {
  set: async (user) =>
    await OnlineUser.updateOne({ user }, {}, { upsert: true }),
  del: async (user) => await OnlineUser.deleteOne({ user }),
  flushDb: async () => await OnlineUser.deleteOne({}),
  KEYS: async () => {
    const keys = await OnlineUser.find({});
    const newKeys = [];
    for (const key of keys) newKeys.push(`${key.user}`);
    return newKeys;
  },
  connect: async () => null,
};

io.sockets.on("connect", async (socket) => {
  const authenticated = (cb) => async (data) => {
    const user = await User.findOne({ _id: data.userId });

    if (!user) {
      socket.emit({ message: "Unauthenticated", success: false, data: {} });
      return socket.disconnect();
    }
    await cb({ user: JSON.parse(JSON.stringify(user)), ...data });
  };

  await client.flushDb();
  socket.on(
    "get-inboxes",
    authenticated(async ({ user }) => {
      const dbMessages = await Message.find({
        $or: [{ sender: user._id }, { receiver: user._id }],
      });

      // console.log(2);
      const myGroups = await GroupMembers.find({
        user: user._id,
        status: "active",
      });
      console.log("1.my groups>>>>", myGroups);
      const myAllGroupsIds = new Set();
      for (const group of myGroups) {
        myAllGroupsIds.add(`${group.group}`);
      }
      let myAllGroupsIdsArr = [];
      for (const id of myAllGroupsIds) {
        myAllGroupsIdsArr.push(id);
      }
      console.log(
        "2.all groups ids>>>>",
        myAllGroupsIds,
        "aar",
        myAllGroupsIdsArr
      );

      const groupMessages = await GroupMessages.find({
        group: { $in: myAllGroupsIdsArr },
      });
      console.log("3, groups msgs>>>>", groupMessages);

      // getting only those groups which have chatt.
      const myGroupsIds = new Set();
      for (const message of groupMessages) {
        myGroupsIds.add(`${message.group}`);
      }
      // console.log(dbMessages);
      const inboxes = new Set();
      for (const message of dbMessages) {
        inboxes.add(message.sender.toString());
        inboxes.add(message.receiver.toString());
      }
      // console.log(3);

      inboxes.delete(user._id.toString());
      // console.log("inboxes", inboxes);
      // console.log("inboxes", inboxes);
      let inboxGroups = [];
      for (const id of myGroupsIds) {
        let group = await Group.findById(id);
        group = JSON.parse(JSON.stringify(group));
        const members = await GroupMembers.find({ group: id }).populate("user");
        group["members"] = members;
        const groupMessages = await GroupMessages.find({ group: id }).sort({
          createdAt: -1,
        });
        group["lastMessage"] = groupMessages[0].message;
        group["lastMessageTime"] = groupMessages[0].createdAt;
        group["lastMessageType"] = groupMessages[0].type;

        let unreadMessagesCount = 0;
        for (const message of groupMessages) {
          if (!message.seenBy.includes(user._id)) {
            unreadMessagesCount++;
          }
        }
        group["unreadMessagesCount"] = unreadMessagesCount;
        inboxGroups.push(group);
      }
      // getting all users , last message by them , unread message count
      let inboxUsers = [];
      for (const inbox of inboxes) {
        let inboxUser_ = await User.findOne({ _id: inbox }).select({
          notifications: 0,
          unreadMessages: 0,
        });
        // console.log("inboxuser_", inboxUser_);
        // console.log(4, inboxUser_);

        let inboxUser = JSON.parse(JSON.stringify(inboxUser_));
        // console.log("inboxUser", inboxUser);
        // console.log("inboxUser===========" + inboxUser);
        let lastMessage = null;

        let lastMessageTime = null;
        let lastMessageType = null;

        // console.log("inboxUser", inboxUser);
        const totalMessages = await Message.find({
          $or: [
            { sender: inboxUser._id, receiver: user._id },
            { sender: user._id, receiver: inboxUser._id },
          ],
        }).sort({ _id: -1 });
        // console.log(5);

        // console.log("==========", totalMessages);
        lastMessage = totalMessages[0].message;
        lastMessageTime = totalMessages[0].messageTime;
        lastMessageType = totalMessages[0].type;

        let unreadMessagesCount = 0;
        for (const message of totalMessages) {
          if (message.seen === false && message.sender.equals(inboxUser._id)) {
            unreadMessagesCount++;
          }
        }
        // console.log("aaaaaaaa");
        console.log("counttt", unreadMessagesCount);

        inboxUser.lastMessage = lastMessage;
        inboxUser["lastMessageTime"] = lastMessageTime;
        inboxUser["lastMessageType"] = lastMessageType;

        inboxUser.unreadMessagesCount = unreadMessagesCount;
        // console.log("bbbbbbb");

        inboxUsers.push(inboxUser);
      }
      // inboxUsers = [...inboxUsers, ...inboxGroups];
      inboxUsers.sort((a, b) =>
        a.lastMessageTime > b.lastMessageTime ? -1 : 1
      );
      inboxGroups.sort((a, b) =>
        a.lastMessageTime > b.lastMessageTime ? -1 : 1
      );
      // console.log(inboxUsers);
      console.log("inbox users", inboxUsers);
      console.log("inbox groups", inboxGroups);

      socket.emit("inboxes", {
        success: true,
        message: "Inbox Retrieved Succcessfully",
        // data: { inboxes: [...inboxes], },
        data: { inboxesOfUsers: inboxUsers, inboxesOfGroups: inboxGroups },
      });
    })
  );
  //get messages
  socket.on(
    "get-messages",
    authenticated(async ({ user, inbox }) => {
      const updatedMessages = await Message.updateMany(
        { sender: inbox, receiver: user._id },
        { seen: true }
      );
      const messages = await Message.find({
        $or: [
          { sender: user._id, receiver: inbox },
          { sender: inbox, receiver: user._id },
        ],
      })
        .populate("sender")
        .populate("receiver")
        .sort({ createdAt: -1 });
      console.log("messages get-messages:", messages);
      io.emit("messages", {
        success: true,
        message: "Messages Retrieved Successfully",
        data: { messages },
      });
    })
  );

  socket.on(
    "send-message",
    authenticated(async ({ user, to, message, messageType, messageTime }) => {
      try {
        const receiver = await User.findOne({ _id: to });

        const dbMessage = await Message.create({
          sender: user._id,
          receiver: to,
          message,
          messageTime,
          seen: false,
          type: messageType,
        });
        const messages = await Message.find({
          $or: [
            { sender: user._id, receiver: to },
            { sender: to, receiver: user._id },
          ],
        })
          .populate("sender")
          .populate("receiver")
          .sort({ createdAt: -1 });
        console.log("message sender-message:", messages);
        io.emit("messages", {
          success: true,
          message: "Messages Retrieved Successfully",
          data: { messages },
        });
      } catch (error) {
        console.log(error);
      }
    })
  );
  socket.on(
    "delete-chat",
    authenticated(async ({ user, inboxId }) => {
      try {
        // Your logic to delete the chat, for example:
        const result = await Message.deleteMany({
          $or: [
            { sender: user._id, receiver: inboxId },
            { sender: inboxId, receiver: user._id },
          ],
        });

        // Notify clients that the chat has been deleted
        io.emit("chat-deleted", {
          success: true,
          message: "Chat Deleted Successfully",
          data: { inboxId },
        });
      } catch (error) {
        console.error("Error deleting chat:", error);
        io.emit("chat-deleted", {
          success: false,
          message: "Failed to delete chat",
          data: { error: error.message },
        });
      }
    })
  );
  socket.on(
    "event",
    process("evented", socket, io, async (req, res) => {
      return res.json({
        a: 1,
      });
    })
  );

  socket.on("user-enter", (data) => {
    console.log(data.body);
    socket.join(data.body.user._id);
  });

  socket.on("user-leave", (data) => socket.leave(data.body.user._id));

  socket.on(
    "createRideRequest",
    process("createdRideRequest", socket, io, rideRequest.store)
  );
  socket.on(
    "calculateFare",
    process("calculatedFare", socket, io, rideRequest.calculateFare)
  );
  socket.on(
    "findnearbyDrivers",
    process("nearByDrivers", socket, io, rideRequest.nearbyDrivers)
  );
  socket.on(
    "updateMyLocation",
    process("updatedLocation", socket, io, rideRequest.updateLocation)
  );
  socket.on("unsub", process("unsubed", socket, io, rideRequest.unsub));

  // ====== Driver Side =======
  socket.on(
    "getNearByRequests",
    process("nearByRequests", socket, io, rideRequest.nearByRequests)
  );
  socket.on(
    "enroutNearByRequests",
    process(
      "enroutedNearByRequests",
      socket,
      io,
      rideRequest.enroutedNearByRequests
    )
  );

  socket.on(
    "startRide",
    process("rideStarted", socket, io, rideRequest.startRide)
  );
  socket.on("arrive", process("arrived", socket, io, rideRequest.arrived));
  socket.on("endRide", process("rideEnded", socket, io, rideRequest.rideEnd));
  socket.on(
    "acceptRequest",
    process("acceptedRequest", socket, io, rideRequest.acceptRequest)
  );

  socket.on(
    "ratingRefresh",
    process("ratingRefreshed", socket, io, rideRequest.ratingRefresh)
  );

  socket.on(
    "cancelRequest",
    process("canceledRequest", socket, io, rideRequest.cancelRequest)
  );
  socket.on(
    "cancelPendingRequest",
    process("canceledPendingRequest", socket, io, rideRequest.cancelRequest)
  );
  socket.on(
    "amountReceive",
    process("amountReceived", socket, io, rideRequest.paymentReceived)
  );
});

module.exports = { io };
