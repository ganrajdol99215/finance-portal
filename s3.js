const AWS = require('aws-sdk');

AWS.config.update({
  region: "ap-south-1"
});

const s3 = new AWS.S3();

async function upload(path, data) {

  await s3.putObject({
    Bucket: "finance-data",
    Key: path,
    Body: data
  }).promise();

}

module.exports = upload;
