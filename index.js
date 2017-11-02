var backup = require('./backup');

exports.handler = function (event, context, callback) {
    var BucketName = process.env.BUCKET_NAME;
    var CapacityFactor = Number.parseFloat(process.env.CAPACITY_FACTOR);
    var TableName = process.env.TABLE_NAME;

    if (Number.isNaN(CapacityFactor) || CapacityFactor > 0.9) {
        CapacityFactor = 0.9;
    }

    if (!BucketName) {
        callback("ERROR missing environment variable BUCKET_NAME");
        return;
    }

    if (!TableName) {
        callback("ERROR missing environment variable TABLE_NAME");
        return;
    }

    var options = {
        BucketName: BucketName,
        TableName: TableName,
        BackupId: event.BackupId,
        SequenceId: event.SequenceId,
        CapacityFactor: CapacityFactor
    };
    console.log(`INFO: starting backup of ${TableName}`, options);
    backup.backupTable(options, context).then((result) => {
        console.log(`INFO: backup of ${TableName} ${result.BackupId} ${result.SequenceId} finished.`);

        if (result.done) {
            console.log(`INFO: backup of ${TableName} ${result.BackupId} completed.`);
        } else {
            console.log(`INFO: Scheduled continuation with sequence ${result.SequenceId + 1}`);
        }
        callback();
    }).catch((err) => {
        console.log(`ERROR: failed to backup ${TableName}`, options);
        callback(err);
    });
};
