// // const lambdaQuery = require("./Utils/");
// const riderRequest = require("./Controllers/riderController");
// const io = require("socket.io")();
// const { Req, Res } = require("./requester");
// const Message = require("./Models/message");
// const User = require("./Models/userModel");

// const OnlineRider = require("./Models/onlineRider");

// // const queries = {};
// // const lastResult = {};
// // let watched = false;

// const process = (evName, socket, io, f) => (data) => {
//   const res = new Res(socket, evName, io);
//   const req = new Req(socket, data, res);
//   if (req?.body?.user) req.user = req.body.user;
//   const final = f(req, res);
//   final
//     ?.then((_) => _)
//     ?.catch((e) => res.error(`${e.message}\n\n${JSON.stringify(e.stack)}`));
// };

// const client = {
//   set: async (user) =>
//     await OnlineRider.updateOne({ user }, {}, { upsert: true }),
//   del: async (user) => await OnlineRider.deleteOne({ user }),
//   flushDb: async () => await OnlineRider.deleteOne({}),
//   KEYS: async () => {
//     const keys = await OnlineRider.find({});
//     const newKeys = [];
//     for (const key of keys) newKeys.push(`${key.user}`);
//     return newKeys;
//   },
//   connect: async () => null,
// };

// io.sockets.on("connect", async (socket) => {
//   const authenticated = (cb) => async (data) => {
//     const user = await User.findOne({ _id: data.userId });

//     if (!user) {
//       socket.emit({ message: "Unauthenticated", success: false, data: {} });
//       return socket.disconnect();
//     }
//     await cb({ user: JSON.parse(JSON.stringify(user)), ...data });
//   };

//   console.log("connection established socket");

//   await client.flushDb();
//   socket.on(
//     "get-inboxes",
//     authenticated(async ({ user }) => {
//       const dbMessages = await Message.find({
//         $or: [{ sender: user._id }, { receiver: user._id }],
//       });
//       console.log("inboxes get socket");

//       // console.log(2);
//       // const myGroups = await GroupMembers.find({
//       //   user: user._id,
//       //   status: "active",
//       // });
//       // console.log("1.my groups>>>>", myGroups);
//       // const myAllGroupsIds = new Set();
//       // for (const group of myGroups) {
//       //   myAllGroupsIds.add(`${group.group}`);
//       // }
//       // let myAllGroupsIdsArr = [];
//       // for (const id of myAllGroupsIds) {
//       //   myAllGroupsIdsArr.push(id);
//       // }
//       // console.log(
//       //   "2.all groups ids>>>>",
//       //   myAllGroupsIds,
//       //   "aar",
//       //   myAllGroupsIdsArr
//       // );

//       // const groupMessages = await GroupMessages.find({
//       //   group: { $in: myAllGroupsIdsArr },
//       // });
//       // console.log("3, groups msgs>>>>", groupMessages);

//       // // getting only those groups which have chatt.
//       // const myGroupsIds = new Set();
//       // for (const message of groupMessages) {
//       //   myGroupsIds.add(`${message.group}`);
//       // }
//       // console.log(dbMessages);
//       const inboxes = new Set();
//       for (const message of dbMessages) {
//         inboxes.add(message.sender.toString());
//         inboxes.add(message.receiver.toString());
//       }
//       console.log(3);

//       inboxes.delete(user._id.toString());
//       console.log("inboxes", inboxes);
//       console.log("inboxes", inboxes);
//       let inboxGroups = [];
//       for (const id of myGroupsIds) {
//         let group = await Group.findById(id);
//         group = JSON.parse(JSON.stringify(group));
//         const members = await GroupMembers.find({ group: id }).populate("user");
//         group["members"] = members;
//         const groupMessages = await GroupMessages.find({ group: id }).sort({
//           createdAt: -1,
//         });
//         group["lastMessage"] = groupMessages[0].message;
//         group["lastMessageTime"] = groupMessages[0].createdAt;
//         group["lastMessageType"] = groupMessages[0].type;

//         let unreadMessagesCount = 0;
//         for (const message of groupMessages) {
//           if (!message.seenBy.includes(user._id)) {
//             unreadMessagesCount++;
//           }
//         }
//         group["unreadMessagesCount"] = unreadMessagesCount;
//         inboxGroups.push(group);
//       }
//       // getting all users , last message by them , unread message count
//       let inboxUsers = [];
//       for (const inbox of inboxes) {
//         let inboxUser_ = await User.findOne({ _id: inbox }).select({
//           notifications: 0,
//           unreadMessages: 0,
//         });
//         console.log("inboxuser_", inboxUser_);
//         console.log(4, inboxUser_);

//         let inboxUser = JSON.parse(JSON.stringify(inboxUser_));
//         console.log("inboxUser", inboxUser);
//         console.log("inboxUser===========" + inboxUser);
//         let lastMessage = null;

//         let lastMessageTime = null;
//         let lastMessageType = null;

//         console.log("inboxUser", inboxUser);
//         const totalMessages = await Message.find({
//           $or: [
//             { sender: inboxUser._id, receiver: user._id },
//             { sender: user._id, receiver: inboxUser._id },
//           ],
//         }).sort({ _id: -1 });
//         console.log(5);

//         console.log("==========", totalMessages);
//         lastMessage = totalMessages[0].message;
//         lastMessageTime = totalMessages[0].messageTime;
//         lastMessageType = totalMessages[0].type;

//         let unreadMessagesCount = 0;
//         for (const message of totalMessages) {
//           if (message.seen === false && message.sender.equals(inboxUser._id)) {
//             unreadMessagesCount++;
//           }
//         }
//         console.log("aaaaaaaa");
//         console.log("counttt", unreadMessagesCount);

//         inboxUser.lastMessage = lastMessage;
//         inboxUser["lastMessageTime"] = lastMessageTime;
//         inboxUser["lastMessageType"] = lastMessageType;

//         inboxUser.unreadMessagesCount = unreadMessagesCount;
//         console.log("bbbbbbb");

//         inboxUsers.push(inboxUser);
//       }
//       // inboxUsers = [...inboxUsers, ...inboxGroups];
//       inboxUsers.sort((a, b) =>
//         a.lastMessageTime > b.lastMessageTime ? -1 : 1
//       );
//       inboxGroups.sort((a, b) =>
//         a.lastMessageTime > b.lastMessageTime ? -1 : 1
//       );
//       console.log(inboxUsers);
//       console.log("inbox users", inboxUsers);
//       console.log("inbox groups", inboxGroups);

//       socket.emit("inboxes", {
//         success: true,
//         message: "Inbox Retrieved Succcessfully",
//         // data: { inboxes: [...inboxes], },
//         data: { inboxesOfUsers: inboxUsers, inboxesOfGroups: inboxGroups },
//       });
//     })
//   );
//   //--------------get messages-------------/////
//   socket.on(
//     "get-messages",
//     authenticated(async ({ user, inbox }) => {
//       const updatedMessages = await Message.updateMany(
//         { sender: inbox, receiver: user._id },
//         { seen: true }
//       );
//       const messages = await Message.find({
//         $or: [
//           { sender: user._id, receiver: inbox },
//           { sender: inbox, receiver: user._id },
//         ],
//       })
//         .populate("sender")
//         .populate("receiver")
//         .sort({ createdAt: -1 });
//       console.log("messages get-messages:", messages);
//       io.emit("messages", {
//         success: true,
//         message: "Messages Retrieved Successfully",
//         data: { messages },
//       });
//     })
//   );

//   socket.on(
//     "send-message",
//     authenticated(async ({ user, to, message, messageType, messageTime }) => {
//       try {
//         const receiver = await User.findOne({ _id: to });

//         const dbMessage = await Message.create({
//           sender: user._id,
//           receiver: to,
//           message,
//           messageTime,
//           seen: false,
//           type: messageType,
//         });
//         const messages = await Message.find({
//           $or: [
//             { sender: user._id, receiver: to },
//             { sender: to, receiver: user._id },
//           ],
//         })
//           .populate("sender")
//           .populate("receiver")
//           .sort({ createdAt: -1 });
//         console.log("message sender-message:", messages);
//         io.emit("messages", {
//           success: true,
//           message: "Messages Retrieved Successfully",
//           data: { messages },
//         });
//       } catch (error) {
//         console.log(error);
//       }
//     })
//   );
//   socket.on(
//     "delete-chat",
//     authenticated(async ({ user, inboxId }) => {
//       try {
//         // Your logic to delete the chat, for example:
//         const result = await Message.deleteMany({
//           $or: [
//             { sender: user._id, receiver: inboxId },
//             { sender: inboxId, receiver: user._id },
//           ],
//         });

//         // Notify clients that the chat has been deleted
//         io.emit("chat-deleted", {
//           success: true,
//           message: "Chat Deleted Successfully",
//           data: { inboxId },
//         });
//       } catch (error) {
//         console.error("Error deleting chat:", error);
//         io.emit("chat-deleted", {
//           success: false,
//           message: "Failed to delete chat",
//           data: { error: error.message },
//         });
//       }
//     })
//   );

//   socket.on(
//     "updateMyLocation",
//     process("updatedLocation", socket, io, riderRequest.updateLocation)
//   );
// });

// module.exports = { io };

const Message = require("./Models/message");
const Chat = require("./Models/chatModel");
const moment = require("moment");
const redis = require("redis");
const Notification = require("./Models/notificationModel");
const RefreshToken = require("./Models/refreshTokenModel");
const User = require("./Models/userModel");
const {
  sendNotification,
  sendNotificationMultiCast,
} = require("./Utils/notificationSender");

const OnlineUser = require("./Models/onlineRider");
const { json } = require("body-parser");
const { JsonWebTokenError } = require("jsonwebtoken");
// const { locationQuery } = require("./geoLocationQuery");
const io = require("socket.io")();

// const client = redis.createClient()
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

///////// User Promises
const userData = {};
const userSocketID = {};

setInterval(async () => {
  try {
    const promises = [];
    for (const userId in userData)
      if (userData[userId]) promises.push(userData[userId]());
    await Promise.all(promises);
  } catch (e) {
    console.log(e);
  }
}, 5 * 1000);
///////////////////////////

client.connect().then(async (_) => {
  await client.flushDb();

  const getOnlineUsers = async () => {
    const userIds = await client.KEYS();
    const users = await User.find({ _id: { $in: userIds } }).select("id");
    io.emit("online-users", {
      message: "Online Users Retrieved Successfully",
      success: true,
      data: { users },
    });
  };

  io.sockets.on("connect", async (socket) => {
    console.log(`Connected to ${socket.id}`);

    function getRoomJoinedSocketIds(roomName) {
      const room = io.in(roomName);
      const socketIds = Object.keys(room.sockets);
      return socketIds;
    }

    /// authenticate user
    const authenticated = (cb) => async (data) => {
      const user = await User.findOne({ _id: data.userId });
      //   console.log("****************" + data.userId);
      //   console.log(user);

      if (!user) {
        socket.emit({ message: "Unauthenticated", success: false, data: {} });
        return socket.disconnect();
      }
      await cb({ user: JSON.parse(JSON.stringify(user)), ...data });
    };
    //// user enter
    socket.on(
      "user-enter",
      authenticated(async ({ user }) => {
        console.log(`User enter Connected to ${socket.id}`);
        //////////// user info SUBSCRIBE
        const f = async () => {
          try {
            ///////// notifications
            const notifictations = await Notification.find({
              $or: [
                {
                  $and: [
                    { notifyType: { $ne: "sendMessage" } },
                    { receiver: user._id },
                    { actionTaken: false },
                  ],
                },
                {
                  $and: [
                    { notifyType: { $ne: "sendMessage" } },
                    { multireceiver: { $in: [user._id] } },
                    { isSeen: { $not: { $elemMatch: { $eq: user._id } } } },
                  ],
                },
              ],
            });
            // console.log(notifictations.length, notifictations.length, user);

            const sizenotif = notifictations.length;
            let action;
            sizenotif > 0 ? (action = false) : (action = true);
            ///////////////////////////////////
            ///////// Chat Count
            let messagescount = 0;
            let ChatRooms;
            ChatRooms = await Chat.find({ users: { $in: [user._id] } }).sort(
              "-updatedAt"
            );

            ChatRooms = JSON.parse(JSON.stringify(ChatRooms));

            for (let i = 0; i < ChatRooms.length; i++) {
              let dbMessages;
              if (ChatRooms[i].chatType === "single") {
                dbMessages = await Message.find({
                  $and: [
                    { messageType: "single" },
                    { chatId: ChatRooms[i]._id },
                    { seen: false },
                    { receiver: { $eq: user._id } },
                  ],
                });
              } else {
                dbMessages = await Message.find({
                  $and: [
                    { messageType: "group" },
                    { chatId: ChatRooms[i]._id },
                    { seenBy: { $not: { $elemMatch: { $eq: user._id } } } },
                  ],
                });
              }

              ChatRooms[i].newMessages = dbMessages.length;
              messagescount = messagescount + dbMessages.length;
            }
            ////////////////////////////////////////
            // socket.emit('info', {...sendingData})
            socket.join(user._id);
            io.to(user._id).emit("notification", {
              success: true,
              message: "Notification Retrieved Successfully",
              data: {
                action: action,
                messages: messagescount,
                notifictationSize: sizenotif,
              },
            });
          } catch (e) {
            console.log(e);
          }
        };
        await f();
        userData[`${user._id}`] = f;
        userSocketID[`${socket.id}`] = user._id;

        //////////// user info SUBSCRIBE-end
        // console.log(user, user._id);
        socket.join(user._id);
        await client.set(user._id);
        await getOnlineUsers();
      })
    );
    //// user leave
    socket.on(
      "user-leave",
      authenticated(async ({ user }) => {
        // user info sub leave
        delete userData[`${user._id}`];
        /// user info sub leave
        await client.del(user._id);
        await getOnlineUsers();
        io.to(user._id).emit("leaving", {
          success: true,
          message: "Socket left",
        });
        socket.leave(user._id);
      })
    );
    // get online users
    socket.on(
      "get-online-users",
      authenticated(async () => {
        await getOnlineUsers();
      })
    );

    socket.on(
      "get-inboxes",
      authenticated(async ({ user }) => {
        /////////////////// Chat Room Find
        console.log(`Get Inboxes Connected to ${socket.id}`);
        let ChatRooms;
        ChatRooms = await Chat.find({ users: { $in: [user._id] } }).sort(
          "-updatedAt"
        );

        ChatRooms = JSON.parse(JSON.stringify(ChatRooms));

        for (let i = 0; i < ChatRooms.length; i++) {
          let dbMessages;
          if (ChatRooms[i].chatType === "single") {
            dbMessages = await Message.find({
              $and: [
                { messageType: "single" },
                { chatId: ChatRooms[i]._id },
                { seen: false },
                { receiver: { $eq: user._id } },
              ],
            });
          } else {
            dbMessages = await Message.find({
              $and: [
                { messageType: "group" },
                { chatId: ChatRooms[i]._id },
                { seenBy: { $not: { $elemMatch: { $eq: user._id } } } },
              ],
            });
          }
          ChatRooms[i].newMessages = dbMessages.length;
        }

        // console.log("Rooms ==>", ChatRooms);

        if (ChatRooms.length < 1) {
          ChatRooms = null;
          io.to(user._id).emit("inboxes", {
            success: true,
            message: "Inbox Retrieved Succcessfully",
            // data: { inboxes: [...inboxes], },
            inboxes: [],
          });
        } else {
          // socket.join(user._id);
          io.to(user._id).emit("inboxes", {
            success: true,
            message: "Inbox Retrieved Succcessfully",
            // data: { inboxes: [...inboxes], },
            inboxes: [...ChatRooms],
          });
        }
      })
    );

    socket.on(
      "join-room",
      authenticated(async ({ user, inbox }) => {
        console.log("SELFID--->> ", user._id, "NEXTUSERID---->", inbox);
        console.log("USER ID IN SOCKET MEMORY ---->", userSocketID[socket.id]);
        let ChatRoom;
        ///////////// Receiver
        const receiveruser = await User.findById(inbox);
        //////////////
        //////////// Chat Room Find
        ChatRoom = await Chat.findOne({
          $and: [{ users: user._id }, { users: inbox }],
        });

        if (!ChatRoom) {
          return io.to(user._id).emit("messages", {
            success: false,
            message: "Messages Retrieved Successfully",
            receiver: receiveruser,
            act: "chat-not-exist",
            messages: [],
          });
        }
        ////////////////////////
        const updatedMessages = await Message.updateMany(
          { sender: inbox, receiver: user._id },
          { seen: true }
        );
        // console.log("updated msgs", updatedMessages);
        let messages;
        messages = await Message.find({
          $and: [
            {
              $or: [{ sender: user._id }, { receiver: user._id }],
            },
            {
              $or: [{ sender: inbox }, { receiver: inbox }],
            },
          ],
        })
          .populate("sender")
          .populate("receiver")
          .populate("post")
          .sort({ createdAt: -1 });

        //////////// MSGS Filtering
        messages = JSON.parse(JSON.stringify(messages));
        for (let i = 0; i < messages.length; i++) {
          if (messages[i].seen === false) {
            console.log("Test 1");
            if (messages[i].sender._id === user._id) {
              console.log("Test 2");
              messages[i].seen = true;
            }
          }
        }
        // .populate("receiver")
        // .populate("sender");
        const chatId = ChatRoom._id.toString();
        // socket.join(user._id);
        console.log("Room id:", chatId);
        socket.join(chatId);
        io.to(user._id).emit("messages", {
          success: true,
          message: "Messages Retrieved Successfully",
          receiver: receiveruser,
          messages: [...messages],
        });
      })
    );
    socket.on(
      "leave-room",
      authenticated(async ({ user, inbox }) => {
        console.log("SELFID--->> ", user._id, "NEXTUSERID---->", inbox);
        let ChatRoom;
        //////////// Chat Room Find
        ChatRoom = await Chat.findOne({
          $and: [{ users: user._id }, { users: inbox }],
        });
        ////////////////////////

        const chatId = ChatRoom._id.toString();
        console.log("Room id:", chatId);
        socket.leave(chatId);
        io.to(user._id).emit("leaving", {
          success: true,
          message: "Room left",
        });
      })
    );
    socket.on(
      "send-message",
      authenticated(
        async ({ user, to, message, messageType, audioLength, postId }) => {
          try {
            ///////////time
            // Get current date in UTC
            // Get current local time
            const currentLocalTime = moment();

            ///////////// Receiver
            const receiveruser = await User.findById(to);
            //////////////

            // Convert local time to UTC
            // const currentUtcTime = currentLocalTime.utc().utcOffset(1);

            // Convert UTC time to Unix timestamp
            const currentUnixTime = currentLocalTime.unix();

            console.log("Current Local Time:", currentLocalTime);
            // console.log("Current UTC Time:", currentUtcTime);
            console.log("Current Unix Timestamp:", currentUnixTime);
            ///////// time

            console.log("innnnn send msg start Startttttttttt");
            const receiver = await User.findOne({ _id: to });

            ///////////////// Room update
            let chat;
            if (messageType === "post") {
              message = `shared location`;
            }
            chat = await Chat.findOne({
              $and: [{ users: user._id }, { users: to }],
            });
            const userr1 = to;
            const user2 = user._id;
            if (!chat) {
              const users = [userr1, user2];
              // console.log(users);
              chat = await Chat.create({
                users: users,
                lastMsgSender: user2,
                LastMessage: message,
                messageTime: currentUnixTime,
                type: messageType,
              });
              const chatId1 = chat._id.toString();
              socket.join(chatId1);
            } else {
              await Chat.findByIdAndUpdate(chat.id, {
                lastMsgSender: user2,
                LastMessage: message,
                messageTime: currentUnixTime,
                type: messageType,
              });
            }
            ///////////////// Room Login
            const chatId = chat._id.toString();
            console.log("Room id in send:", chatId);
            // socket.join(chatId);
            const joinedPeople = io.sockets.adapter.rooms.get(chatId);
            console.log("Room People:", joinedPeople);
            // console.log("Room People v2:", getRoomJoinedSocketIds(chatId));
            const joinedPeopleCount = joinedPeople ? joinedPeople.size : 0;

            //////////////////////

            ///////// create msg logic
            const dbMessage = await Message.create({
              chatId: chat._id,
              sender: user._id,
              receiver: to,
              message,
              post: postId,
              messageTime: currentUnixTime,
              audioLength: audioLength,
              seen: joinedPeopleCount > 1 ? true : false,
              type: messageType,
            });

            await Chat.findByIdAndUpdate(chat.id, {
              lastMessageId: dbMessage._id,
            });

            const currentmessage = await Message.findById(dbMessage?._id)
              .populate("sender")
              .populate("receiver")
              .populate("post");

            const messages = await Message.find({
              $and: [
                {
                  $or: [{ sender: user._id }, { receiver: user._id }],
                },
                {
                  $or: [{ sender: to }, { receiver: to }],
                },
              ],
            })
              .populate("sender")
              .populate("receiver")
              .populate("post")
              .sort({ createdAt: -1 });

            //////////// Notify

            ///////////////////
            // await sendNotification({
            //   type: "sendMessage",
            //   sender: user,
            //   receiver,
            //   title: "sent message",
            //   deviceToken: receiver.deviceToken,
            //   body: `${user.name} sent you a message`,
            // });

            io.to(chatId).emit("messages", {
              success: true,
              message: "Messages Retrieved Successfully",
              receiver: receiveruser,
              messages: [currentmessage],
            });

            if (joinedPeopleCount < 2) {
              const tokens = [];
              const notificationData = [];
              const user1 = await User.findById(to);

              const userTokens = JSON.parse(
                JSON.stringify(await RefreshToken.find({ user: user1?.id }))
              ).map(({ deviceToken }) => deviceToken);

              if (user1.isNotification && userTokens.length > 0) {
                tokens.push(...userTokens);
                // notificationData.push({ ...user1 });
                if (tokens.length > 0) {
                  // console.log(tokens, user._id, user.name);
                  await sendNotificationMultiCast({
                    tokens: tokens,
                    sender: user._id,
                    type: "sendMessage",
                    title: "New Message",
                    body: `${user.firstName} sent you a message`,
                    data: {
                      value: JSON.stringify(user),
                    },
                  });
                }
              }

              ////////////// Receiver Logic

              let ChatRooms;
              ChatRooms = await Chat.find({ users: { $in: [to] } }).sort(
                "-updatedAt"
              );
              // .limit(1);

              ChatRooms = JSON.parse(JSON.stringify(ChatRooms));

              for (let i = 0; i < ChatRooms.length; i++) {
                const dbMessages = await Message.find({
                  $and: [
                    { chatId: ChatRooms[i]._id },
                    { seen: false },
                    { receiver: { $eq: to } },
                  ],
                });

                ChatRooms[i].newMessages = dbMessages.length;
              }
              console.log("Rooms ==>", ChatRooms);

              if (ChatRooms.length < 1) {
                ChatRooms = null;
              }
              // socket.join(user._id);
              io.to(to).emit("inboxes", {
                success: true,
                message: "Inbox Retrieved Succcessfully",
                // data: { inboxes: [...inboxes], },
                inboxes: [...ChatRooms],
              });
            }
            // io.emit("new-message", {
            //   success: true,
            //   message: "Messages Found Successfully",
            //   data: { message: dbMessage },
            // });
          } catch (error) {
            console.log(error);
          }
        }
      )
    );
    //////////////// Delete Message
    socket.on(
      "delete-message",
      authenticated(async ({ user, messageId }) => {
        console.log("SELFID--->> ", user._id, "messageId---->", messageId);
        const message = await Message.findById(messageId);
        const chat = await Chat.findById(message.chatId);
        await Message.findByIdAndDelete(messageId);
        const chatId = chat._id.toString();
        io.to(chatId).emit("message-delete", {
          success: true,
          messageId,
          message: "Message Deleted",
        });

        if (
          chat.lastMessageId.toString() === messageId &&
          message.messageType !== "broadcast"
        ) {
          const latestMessage = await Message.find({ chatId: chat._id })
            .sort("-createdAt")
            .limit(1);
          if (latestMessage.length > 0) {
            await Chat.findByIdAndUpdate(
              chat.id,
              {
                lastMsgSender: latestMessage.sender,
                LastMessage: latestMessage.message,
                lastMessageId: latestMessage.lastMessageId,
                messageTime: latestMessage.createdAt,
                type: latestMessage.type,
              },
              { new: true }
            );
          } else {
            await Chat.findByIdAndDelete(chat._id);
          }

          ///////////heads update
          await Promise.all(
            chat.users.map(async (headuser) => {
              // console.log("In Promise");
              let ChatRooms;
              ChatRooms = await Chat.find({
                users: { $in: [headuser._id] },
              }).sort("-updatedAt");
              // .limit(1);

              ChatRooms = JSON.parse(JSON.stringify(ChatRooms));

              for (let i = 0; i < ChatRooms.length; i++) {
                let dbMessages;
                if (ChatRooms[i].chatType === "single") {
                  dbMessages = await Message.find({
                    $and: [
                      { messageType: "single" },
                      { chatId: ChatRooms[i]._id },
                      { seen: false },
                      { receiver: { $eq: headuser._id } },
                    ],
                  });
                } else {
                  dbMessages = await Message.find({
                    $and: [
                      { messageType: "group" },
                      { chatId: ChatRooms[i]._id },
                      {
                        seenBy: { $not: { $elemMatch: { $eq: headuser._id } } },
                      },
                    ],
                  });
                }

                ChatRooms[i].newMessages = dbMessages.length;
              }
              // console.log("Rooms ==>", ChatRooms);

              if (ChatRooms.length < 1) {
                ChatRooms = null;
              }
              // socket.join(user._id);
              io.to(headuser._id).emit("inboxes", {
                success: true,
                message: "Inbox Retrieved Succcessfully",
                // data: { inboxes: [...inboxes], },
                inboxes: [...ChatRooms],
              });
            })
          );
        }
      })
    );

    socket.on("disconnect", async () => {
      console.log("User disconnected: ", socket.id);
      if (userSocketID[socket.id]) {
        await client.del(userSocketID[socket.id]);
        await getOnlineUsers();
        delete userSocketID[`${socket.id}`];
        if (userData[`${userSocketID[socket.id]}`]) {
          delete userData[`${userSocketID[socket.id]}`];
        }
      }
    });
  });
});

module.exports = { io };
