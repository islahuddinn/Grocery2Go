const catchAsync = require("../Utils/catchAsync");
const List = require("../Models/listModel");
const Factory = require("../Controllers/handleFactory");

exports.addProductsToList = catchAsync(async (req, res, next) => {
  const { items } = req.body;
  const newList = await List.create({
    user: req.user.id,
    items: items,
  });

  res.status(200).json({
    success: true,
    status: 200,
    data: newList,
  });
});

exports.editProductInList = catchAsync(async (req, res, next) => {
  const { listId, itemId, productName, quantity } = req.body;

  const list = await List.findById(listId);

  if (!list) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "List not found",
    });
  }

  const item = list.items.id(itemId);
  if (!item) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Item not found in list",
    });
  }

  if (productName) item.productName = productName;
  if (quantity) item.quantity = quantity;

  await list.save();

  res.status(200).json({
    success: true,
    status: 200,
    data: list,
  });
});

exports.deleteProductFromList = catchAsync(async (req, res, next) => {
  const { listId, itemId } = req.body;

  const list = await List.findById(listId);

  if (!list) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "List not found",
    });
  }

  const item = list.items.id(itemId);
  if (!item) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Item not found in list",
    });
  }
  list.items.pull(itemId);
  await list.save();

  res.status(200).json({
    success: true,
    status: 200,
    data: list,
  });
});

exports.updateList = Factory.updateOne(List);
exports.getOneList = Factory.getOne(List);
exports.deleteList = Factory.deleteOne(List);
