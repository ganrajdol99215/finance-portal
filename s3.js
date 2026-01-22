const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  region: "us-east-1"
});

const BUCKET = "finance-data-ganraj";

module.exports = async (key, content) => {
  return s3.putObject({
    Bucket: BUCKET,
    Key: key,
    Body: content
  }).promise();
};

