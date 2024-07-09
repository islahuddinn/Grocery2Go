const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: "AKIA3FLDXV3SL7RYTQSL",
  secretAccessKey: "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",
});

const uploadFile = async (file) => {
  const params = {
    Bucket: "gro2go-bucket",
    Key: `grocery2go-app-${Date.now()}-${file.name}`,
    Body: file.data,
  };
  const data = await s3.upload(params).promise();
  return data.Location; // returns the url location
};

module.exports = {
  uploadFile,
};
