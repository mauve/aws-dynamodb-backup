var backup = require('./backup');

exports.handler = function (event, context) {
    var bucketName = process.env.BUCKET_NAME;
    var capacityFactor = Number.parseFloat(process.env.CAPACITY_FACTOR);

    if (Number.isNaN(capacityFactory) || capacityFactor > 0.9) {
        capacityFactor = 0.9;
    }

    if (!bucketName) {
        console.log("ERROR missing environment variable BUCKET_NAME");
    }

    backup.backupAll(context, bucketName, capacityFactor);
};
