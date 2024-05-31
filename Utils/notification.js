// const admin = require("firebase-admin");
// let serviceAccount = require("../Utils/wanna-come-firebase-adminsdk-5ornu-b7b9bceaec.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

module.exports = {
  SendNotification: ({ token, title, body }) =>
    new Promise(async (resolve, reject) => {
      try {
        console.log("FCM TOKEN: ", token);

        if (!token || !title || !body) {
          return reject(new Error("FCM token, title or body is required."));
        }

        const message = {
          token: token,
          notification: {
            title,
            body,
          },
          android: {
            notification: {
              sound: "default",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        };

        const response = await admin.messaging().send(message);
        console.log("Message was sent successfully", response);
        resolve(response);
      } catch (error) {
        console.log("Error in sending message internally: ", error);
        reject(error);
      }
    }),

  SendNotificationMultiCast: ({ tokens, title, body, data }) =>
    new Promise(async (resolve, reject) => {
      try {
        console.log("dataaaa", data);
        console.log("FCM TOKENS: ", tokens);

        const message = {
          notification: {
            title,
            body,
          },
          android: {
            notification: {
              sound: "default",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
          data: { notification: JSON.stringify(data) },
          tokens: tokens,
        };

        admin
          .messaging()
          .sendMulticast(message)
          .then((response) => {
            console.log("Messages were sent successfully", response);
            resolve(response);
          })
          .catch((err) => {
            console.log("Error in sending messages: ", err);
            reject({
              message:
                err.message || "Something went wrong in sending notifications!",
            });
          });
      } catch (error) {
        console.log("ERROR", error);
        reject(error);
      }
    }),
};
