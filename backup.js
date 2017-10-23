var aws = require('aws-sdk');
var stream = require('stream');
var ReadableStream = require('./readable-stream');
var zlib = require('zlib');
var async = require('async');

var dateFormat = require('dateformat');

dynamo = new aws.DynamoDB();
lambda = new aws.Lambda();

function __scanTable(params, process) {
  function onScan(data) {
    Promise.resolve(process(data)).then((timeoutReached) => {
      if (timeoutReached)
        return;

      if (typeof data.LastEvaluatedKey != "undefined") {
        // continue scanning
        params.ExclusiveStartKey = data.LastEvaluatedKey;

        data = null;
        return dynamo.scan(params).promise().then((result) => {
          onScan(result);
        });
      }
    });
  }

  // start scanning table
  return dynamo.scan(params).promise().then((data) => onScan(data));
}

function __rescheduleLambda(LastEvaluatedKey, options, context) {
  var payload = {
    ExclusiveStartKey: LastEvaluatedKey,
    BackupId: options.BackupId,
    SequenceId: options.SequenceId + 1
  };

  return lambda.invoke({
    FunctionName: context.invokedFunctionArn,
    Payload: JSON.stringify(payload),
    InvocationType: 'EVENT'
  }).promise().catch((err) => {
    console.log(`ERROR could not trigger continuation: ${payload} for ${context.invokedFunctionArn}`, err);
    throw(err);
  });
}

function __processTable(table, timeoutReached, rescheduleLambda) {
  // first write metadata as header
  var header = {
    Table: table,
    backupId: options.BackupId,
    sequenceId: options.SequenceId
  };
  data_stream.append(JSON.stringify(header));
  data_stream.append("\n");

  return __scanTable({
    TableName: table.TableName,
    ReturnConsumedCapacity: 'NONE',
    Limit: table.ProvisionedThroughput.ReadCapacityUnits * capacityFactor,
  },
  (data) => {
    for (var idx = 0; idx < data.Items.length; idx++) {
      data_stream.append(JSON.stringify(data.Items[idx]));
      data_stream.append("\n");
    }

    if (timeoutReached()) {
      return rescheduleLambda(data.LastEvaluatedKey).then(() => false);
    } else {
      return true;
    }
  });
}

function backupTable(options, context, callback) {
  var data_stream = new ReadableStream();
  var gzip = zlib.createGzip();

  options.BackupId = options.BackupId || dateFormat(new Date(), "mmddyyyy-HHMMss");
  options.SequenceId = options.SequenceId || 0;

  var key = `${options.TableName}/${options.BackupId}/${options.SequenceId}.gz`;

  var s3obj = new aws.S3({
    params: {
      Bucket: options.BucketName,
      Key: key
    }
  });

  var uploadPromise = s3obj.upload({
      Body: data_stream.pipe(gzip)
    }).on('httpUploadProgress', (evt) => {
      console.log("INFO: HTTP upload progress", evt);
    }).promise().then((data) => {
      console.log(`INFO: S3 upload of backup to ${data.Bucket} ${data.Key} succeeded.`);
      console.log(`INFO: Backup is available at: ${data.Location} (E-tag: ${data.ETag})`);
      return data;
    }).catch((err) => {
      console.log(`ERROR: S3 upload of ${key} (${options.BucketName}) failed:`, err);
      throw(err);
    });

  var backupPromise = dynamo.describeTable({
    TableName: options.TableName
  }).promise().then((data) => {
    return __processTable(data.Table,
      () => context.getRemainingTimeInMillis() < 30000,
      (LastEvaluatedKey) => {
        return __rescheduleLambda(LastEvaluatedKey, options, context);
      });
  }).then(() => {
    data_stream.end();
  }).catch((err) => {
    console.log(`ERROR: describe of table ${options.TableName} failed ${err}: ${data}`);
    data_stream.end();
    throw(err);
  });

  return Promise.all(uploadPromise, backupPromise).then((results) => {
    return {
      BackupId: options.BackupId,
      SequenceId: options.SequenceId
    };
  });
}

module.exports.backupTable = backupTable;