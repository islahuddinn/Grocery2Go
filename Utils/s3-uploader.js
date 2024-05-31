const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: "",
  secretAccessKey: "",
});

const uploadFile = async (file) => {
  const params = {
    Bucket: "grocery2go-bucket",
    Key: `grocery2go-app-${Date.now()}-${file.name}`,
    Body: file.data,
  };
  const data = await s3.upload(params).promise();
  return data.Location; // returns the url location
};

module.exports = {
  uploadFile,
};
