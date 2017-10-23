# DynamoDB Backup

### Building distributable package for upload to lambda

```
$ npm run build
```

### Create a lambda function

1. Within lambda, press the 'Create a Lambda Function' button
1. Press the 'Skip' button to bypass the suggested blueprints
1. Enter the lambda function name dynamodb-backup
1. Select 'Node.js' as the Runtime
1. Upload the zip
1. Under 'Handler' add 'Index.handler'
1. Add two environment variables:
   1. TABLE_NAME which is the table to backup
   1. BUCKET_NAME which is the bucket to publish to
   1. (optional) CAPACITY_FACTOR a float less than 0.9 which controls how much
      of the provisioned read capacity to consume

More [documentation on Lambda](https://docs.aws.amazon.com/lambda/latest/dg/getting-started.html)

### Configure the access policy for your lambda role

Your lambda function will run as an IAM role.  This is where we configure the permissions required.

#### Lambda function master policy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject"
            ],
            "Resource": [
                "arn:aws:s3:::*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:DescribeTable",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "${TABLE_NAME}"
            ]
        }
    ]
}
```

This contains permissions for:

1. Saving logs for your lambda execution.
2. Stroring zipped dynamo backups from dynamo to S3.
3. List dynamo tables and get dynamo data

### Restore example

There is an example restore function in restore.js.  Example usage

```
./restore.js -b table-backups -s instances -t stages
```

The usage is:

```
[aws-dynamodb-backup (master)]$ ./restore.js -h

  Usage: restore [options]

  Options:

    -h, --help                     output usage information
    -b, --bucketname <bucketname>  The name of the s3 bucket to restore from
    -t, --target <target>          The name of the table to create
    -s, --source <source>          The name of source file

```

All the options are required.  The source is the directory and name of the backup file.  The target is the name of the table to restore the data to.
