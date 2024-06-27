const OrderDeliveryRequest = require("../Models/orderDeliveryModel.js");
const RefreshToken = require("../Models/refreshTokenModel.js");
const User = require("../Models/userModel.js");
const nearBys = {};
const nearByRequests = {};
// const TxDeleter = require("../txDeleter");
// const {
//   Query,
//   QueryModel,
//   QueryBuilder,

//   Matcher,
//   Eq,

//   PostProcessor,
// } = require("../Utils/query");
const catchAsync = require("../Utils/catchAsync.js");

// const admin = require("firebase-admin");
// const serviceAccount = require("../firebase.json");
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

const singleNotification = ({ token, title, body, data }) =>
  new Promise(async (resolve, reject) => {
    try {
      admin
        .messaging()
        .send({
          token: token,
          notification: {
            title,
            body,
          },
          // data: newData,
        })
        .then((response) => {
          console.log("Message were sent successfully", response);
          resolve(response);
        })
        .catch((err) => {
          console.log("Error in sending msg internally: ", err);
          // reject({
          //   message:
          //     err.message || "Something went wrong in sending notification!",
          // });
          resolve();
        });
    } catch (error) {
      console.log("ERROR", error);
      // reject(error);
      resolve();
    }
  });

const sendNotification = async (user, body) => {
  const tokens = JSON.parse(
    JSON.stringify(await RefreshToken.find({ user }))
  ).map(({ deviceToken }) => deviceToken);

  for (const deviceToken of tokens)
    await singleNotification({
      token: deviceToken,
      title: "Designated",
      body,
    });
  // }
};

setInterval(async () => {
  for (const userId in nearBys) {
    await nearBys[userId]();
  }
}, 5000);
setInterval(async () => {
  for (const userId in nearByRequests) {
    await nearByRequests[userId]();
  }
}, 2000);

exports.find = catchAsync(async (req, res, next) => {
  console.log("params", req.params.id);
  const orderRequest = await OrderDeliveryRequest.findOne({
    _id: req.params.id,
  })
    .populate("acceptedBy")
    .populate("requestedBy");
  console.log("orderRequest", orderRequest);
  res.status(200).json({
    status: 200,
    success: true,
    message: "",
    data: { orderRequest },
  });
});

exports.index = catchAsync(async (req, res, next) => {
  console.log("Order delivery Request : ", req.body);
  const orderDeliveryRequests = await OrderDeliveryRequest.find({
    $and: [
      { $or: [{ status: "completed" }, { status: "pending" }] },
      { $or: [{ requestedBy: req.user._id }, { acceptedBy: req.user._id }] },
    ],
  })
    .populate("acceptedBy")
    .populate("canceledBy")
    .populate("requestedBy");
  console.log("Ride Request", orderDeliveryRequests);
  res.status(200).json({
    status: 200,
    success: true,
    records: orderDeliveryRequests?.length,
    message: "",
    data: { history: orderDeliveryRequests },
  });
});

exports.store = async (req, res, next) => {
  // console.log("hitttttttttt",req,res)
  const orderRequest = await OrderDeliveryRequest.create({
    ...JSON.parse(JSON.stringify(req.body)),
    requestedBy: req.user._id,
  });
  // const users=await User.find({online:true,location: { $geoWithin: { $centerSphere: [[req.body.startLocation.coordinates[0], req.body.startLocation.coordinates[1]], process.env.RIDE_RADIUS] } }})
  setTimeout(async function () {
    const rideRequest2 = await OrderDeliveryRequest.findOne({
      _id: orderRequest._id,
    });
    console.log("checking for status", rideRequest2);
    if (rideRequest2.status == "pending")
      await OrderDeliveryRequest.findByIdAndDelete(orderRequest._id);
    console.log("Order delivery request  is deleted after 1 minutes.");
  }, 70000);
  res.status(200).json({
    status: 200,
    success: true,
    message: "OrderDeliveryRequest Created Successfully",
    data: { orderRequest },
  });
};
exports.nearbyDrivers = async (req, res, next) => {
  console.log("nearby Hitttttt");
  const f = async () => {
    console.log("hitttttttttt", req.body);
    const user = await User.findById(req.user._id);
    console.log(
      "userrrrrrrrrr",
      user.location.coordinates[0],
      process.env.RIDE_RADIUS
    );
    const users = await User.find({
      online: true,
      location: {
        $geoWithin: {
          $centerSphere: [
            [user.location.coordinates[0], user.location.coordinates[1]],
            4 / 6378.1,
          ],
        },
      },
    });
    // const users=await User.find({online:true })

    console.log("in end...");
    res.status(200).json({
      status: 200,
      success: true,
      message: "get",
      data: { drivers: users },
    });
  };
  await f();
  nearBys[req.user._id] = f;
};
exports.unsub = async (req, res, next) => {
  delete nearBys[req.user._id];
  delete nearByRequests[req.user._id];

  res.status(200).json({
    status: 200,
    success: true,
    message: "unsub",
    data: {},
  });
};
exports.acceptRequest = async (req, res, next) => {
  const request = await OrderDeliveryRequest.findById(req.body.requestId);
  if (!request) {
    return res.status(200).json({
      status: 400,
      success: true,
      message: "Invalid request id",
      data: {},
    });
  }
  if (request.status != "pending") {
    return res.status(400).json({
      status: 400,
      success: true,
      message: "Already taken",
      data: {},
    });
  }
  await OrderDeliveryRequest.findByIdAndUpdate(request._id, {
    $set: { status: "accepted", acceptedBy: req.user._id },
  });
  const updatedRequest = await OrderDeliveryRequest.findById(
    req.body.requestId
  ).populate("acceptedBy");
  res.status(200).json({
    status: 200,
    success: true,
    message: "accepted",
    data: {},
  });
  res
    .all(req.user._id)
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "accepted",
      data: { intendedUser: req.user._id },
    });
  console.log("customerrr>", request.requestedBy.toString());
  res
    .all(request.requestedBy.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "Request accepted",
      data: {
        request: updatedRequest,
        intendedUser: request.requestedBy.toString(),
      },
    });

  await sendNotification(
    request.requestedBy.toString(),
    "Order delivery request has been accepted by a driver"
  );
};

exports.nearByRequests = async (req, res, next) => {
  console.log("***** NEARBY REQUESTS HITT*****", req.body);
  const f = async () => {
    const user = await User.findById(req.user._id);
    const requests = await OrderDeliveryRequest.find({
      status: "pending",
      rideType: user.vehicleInfo.vehicleType,
      startLocation: {
        $geoWithin: {
          $centerSphere: [
            [user.location.coordinates[0], user.location.coordinates[1]],
            4 / 6378.1,
          ],
        },
      },
    }).populate("requestedBy");

    res.status(200).json({
      status: 200,
      success: true,
      message: "nearby requests",
      data: { requests },
    });
  };
  await f();
  nearByRequests[req.user._id] = f;
  //
};

exports.enroutedNearByRequests = async (req, res, next) => {
  console.log("*****Enroute NEARBY REQUESTS HITT*****", req.body);
  const f = async () => {
    const user = await User.findById(req.user._id);
    const requests = await OrderDeliveryRequest.find({
      status: "pending",
      startLocation: {
        $geoWithin: {
          $centerSphere: [
            [user.location.coordinates[0], user.location.coordinates[1]],
            4 / 6378.1,
          ],
        },
      },
      endLocation: {
        $geoWithin: {
          $centerSphere: [
            [
              req.body.destination.coordinates[0],
              req.body.destination.coordinates[1],
            ],
            4 / 6378.1,
          ],
        },
      },
    }).populate("requestedBy");

    res.status(200).json({
      status: 200,
      success: true,
      message: "nearby requests",
      data: { requests },
    });
  };
  await f();
  nearByRequests[req.user._id] = f;
  //
};
exports.updateLocation = async (req, res, next) => {
  console.log("Update my location hitt>> ", req.body, req.user);

  const users = await User.findByIdAndUpdate(req.body.user._id, {
    location: req.body.location,
  });

  res
    .to(req.body.user._id.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "updated",
      data: { location: req.body.location },
    });
  if (req.body.to) {
    res
      .to(req.body.to.toString())
      .status(200)
      .json({
        status: 200,
        success: true,
        message: "updated",
        data: { location: req.body.location },
      });
  }
};
exports.calculateFare = async (req, res, next) => {
  console.log("<<<<<<<<<<<<<<hitttttttttttttttttt");

  console.log("body>>>>>>", req.body);

  // const type = req.body.type;
  const km = req.body.distance / 1000;
  const distance = km * 0.621371; // converting in miles
  console.log("body>>>>>>", req.body);

  console.log("distance>>>>>>", req.body);

  console.log("type>>>>>>", req.body);

  // const fare=112
  let fare = {
    // black: 190,
    bike: 100,
    xl: 230,
    x: distance > 5 ? 20 + distance * 2 : 20,
    taxi: distance > 5 ? 24 + distance * 5 : 24,
    mini: distance > 5 ? 16 + distance * 2 : 16,
  };
  console.log("fare>>>>>>", fare);

  res.status(200).json({
    status: 200,
    success: true,
    message: "fare calculated",
    data: { fare },
    // data: {fare:122},
  });
};

exports.ratingRefresh = async (req, res) => {
  console.log("RIDE REFRESH", req.body.requestId);
  const orderRequest = await OrderDeliveryRequest.findById(req.body.requestId)
    .populate("acceptedBy")
    .populate("requestedBy");

  res
    .status(200)
    .all(orderRequest.acceptedBy._id)
    .json({
      status: 200,
      success: true,
      message: "",
      data: {
        driver: orderRequest.acceptedBy,
        rider: orderRequest.requestedBy,
        intendedUser: orderRequest.acceptedBy._id,
      },
    });

  res
    .status(200)
    .all(orderRequest.requestedBy._id)
    .json({
      status: 200,
      success: true,
      message: "",
      data: {
        driver: orderRequest.acceptedBy,
        rider: orderRequest.requestedBy,
        intendedUser: orderRequest.requestedBy._id,
      },
    });
};

exports.update = catchAsync(async (req, res, next) => {
  const orderRequest = await OrderDeliveryRequest.findByIdAndUpdate(
    req.params.id,
    { $set: JSON.parse(JSON.stringify(req.body)) },
    { new: true }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "OrderDeliveryRequest Edited",
    data: { orderRequest },
  });
});

exports.delete = catchAsync(async (req, res, next) => {
  let orderRequest = await OrderDeliveryRequest.findOne(
    req.params.id
      ? { _id: req.params.id }
      : JSON.parse(decodeURIComponent(req.query))
  );
  orderRequest = await TxDeleter.deleteOne(
    "OrderDeliveryRequest",
    req.params.id
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "OrderDeliveryRequest Deleted",
    data: { orderRequest },
  });
});

exports.myCurrentStatus = catchAsync(async (req, res, next) => {
  let request = await OrderDeliveryRequest.findOne({
    $and: [
      { status: { $ne: "completed" } },
      { status: { $ne: "canceled" } },
      { acceptedBy: req.user._id },
    ],
  });

  res.status(200).json({
    status: 200,
    success: true,
    message: "OrderDeliveryRequest Deleted",
    data: { request },
  });
});

exports.cancelRequest = async (req, res, next) => {
  console.log("************* CANCEL REQUEST HIT **********", req.body);
  const request = await OrderDeliveryRequest.findById(req.body.requestId);
  if (!request) {
    return res.status(200).json({
      status: 400,
      success: true,
      message: "No Request Found",
      data: {},
    });
  }
  console.log("Req>>", request);
  //  if(request.status = "canceled"){
  //   return res.status(400).json({
  //     status: 400,
  //     success: true,
  //     message: 'Already done',
  //     data: {},
  //   });
  //  }
  await OrderDeliveryRequest.findByIdAndUpdate(request._id, {
    $set: {
      status: "canceled",
      canceledBy: req.user._id,
      reason: req.body.reason,
    },
  });
  const updatedRequest = await OrderDeliveryRequest.findById(req.body.requestId)
    .populate("acceptedBy")
    .populate("requestedBy");
  res.status(200).json({
    status: 200,
    success: true,
    message: "canceled",
    data: { request: updatedRequest },
  });
  if (request.acceptedBy)
    res
      .all(request.acceptedBy.toString())
      .status(200)
      .json({
        status: 200,
        success: true,
        intendent: request.acceptedBy.toString(),
        message: "canceled",
        data: { request: updatedRequest },
      });
  // console.log("customerrr>",request.requestedBy.toString())
  res
    .all(request.requestedBy.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      intendent: request.requestedBy.toString(),
      data: { request: updatedRequest },
    });

  let toUser = null;
  if (request.status == "pending") {
  }
  if (request.requestedBy.toString() == req.user._id)
    toUser = request.acceptedBy.toString();
  else toUser = request.requestedBy.toString();

  await sendNotification(toUser, "Your request has been cancelled");
};

exports.startRide = async (req, res, next) => {
  console.log("************* START RIDE  HIT **********", req.body);
  const request = await OrderDeliveryRequest.findById(req.body.requestId);
  if (!request) {
    return res.status(200).json({
      status: 400,
      success: true,
      message: "Invalid request id",
      data: {},
    });
  }

  await OrderDeliveryRequest.findByIdAndUpdate(request._id, {
    $set: { started: true },
  });
  const updatedRequest = await OrderDeliveryRequest.findById(req.body.requestId)
    .populate("acceptedBy")
    .populate("requestedBy");

  await sendNotification({
    type: "rideStarted",
    sender: req.user,
    receiver: updatedRequest.requestedBy,
    title: "Ride started",
    requestId: req.body.requestId,
    deviceToken: updatedRequest.requestedBy.deviceToken,
    body: `Ride started`,
    createdAt: req.body.createdAt,
  });

  res.status(200).json({
    status: 200,
    success: true,
    message: "started",
    data: { request: updatedRequest },
  });
  res
    .to(request.acceptedBy.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "started",
      data: { request: updatedRequest },
    });
  // console.log("customerrr>",request.requestedBy.toString())
  res
    .to(request.requestedBy.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "started",
      data: { request: updatedRequest },
    });

  await sendNotification(
    request.requestedBy.toString(),
    "Your request has been started"
  );
};
exports.arrived = async (req, res, next) => {
  console.log("************* ARRIVE HIT **********", req.body);
  const request = await OrderDeliveryRequest.findById(req.body.requestId);
  if (!request) {
    return res.status(200).json({
      status: 400,
      success: true,
      message: "Invalid request id",
      data: {},
    });
  }

  await OrderDeliveryRequest.findByIdAndUpdate(request._id, {
    $set: { arrived: true },
  });
  const updatedRequest = await OrderDeliveryRequest.findById(req.body.requestId)
    .populate("acceptedBy")
    .populate("requestedBy");

  await sendNotification({
    type: "driverArrived",
    sender: req.user,
    receiver: updatedRequest.requestedBy,
    title: "Driver arrived",
    requestId: request._id,
    deviceToken: updatedRequest.requestedBy.deviceToken,
    body: `${req.user.name} is arrived`,
    createdAt: req.body.createdAt,
  });
  res.status(200).json({
    status: 200,
    success: true,
    message: "arrived",
    data: { request: updatedRequest },
  });
  res
    .to(request.acceptedBy.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "arrived",
      data: { request: updatedRequest },
    });
  // console.log("customerrr>",request.requestedBy.toString())
  res
    .to(request.requestedBy.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "arrived",
      data: { request: updatedRequest },
    });

  await sendNotification(
    request.requestedBy.toString(),
    "Your driver has arrived"
  );
};
exports.rideEnd = async (req, res, next) => {
  console.log("************* START RIDE  HIT **********", req.body);
  const request = await OrderDeliveryRequest.findById(req.body.requestId);
  if (!request) {
    return res.status(200).json({
      status: 400,
      success: true,
      message: "Invalid request id",
      data: {},
    });
  }

  await OrderDeliveryRequest.findByIdAndUpdate(request._id, {
    $set: { rideEnd: true, status: "completed" },
  });
  const updatedRequest = await OrderDeliveryRequest.findById(req.body.requestId)
    .populate("acceptedBy")
    .populate("requestedBy");
  res.status(200).json({
    status: 200,
    success: true,
    message: "rideEnd",
    data: { request: updatedRequest },
  });
  res
    .to(request.acceptedBy.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "rideEnd",
      data: { request: updatedRequest },
    });
  // console.log("customerrr>",request.requestedBy.toString())
  res
    .to(request.requestedBy.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      message: "rideEnd",
      data: { request: updatedRequest },
    });
  await sendNotification(
    request.requestedBy.toString(),
    "Your ride has been ended"
  );
};

exports.paymentReceived = async (req, res, next) => {
  console.log("*************payment received HIT **********", req.body);

  res
    .all(req.body.to.toString())
    .status(200)
    .json({
      status: 200,
      success: true,
      intendent: req.body.to,
      message: "payment received",
      data: { amount: req.body.amount },
    });
  ~(
    // res.status(200).json({
    //   status: 200,
    //   success: true,
    //   message: 'payment received ',
    //   data: {amount:req.body.amount},
    // });
    // console.log("customreerrr>",request.requestedBy.toString())
    console.log("idddd", req.body.to.toString())
  );

  await sendNotification(req.body.to.toString(), "You have been payed");
};
