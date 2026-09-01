#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LinkyStack } from '../lib/linky-stack';

const app = new cdk.App();

// Name of the Secrets Manager secret holding GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET and JWT_SECRET. Created out of band; this stack only
// references it and never reads its value.
const secretName = app.node.tryGetContext('secretName') || 'linky/prod';

// Optional explicit public origin. Left unset, the Lambda derives it from the
// x-forwarded-host header injected by a CloudFront Function.
const appUrl = app.node.tryGetContext('appUrl');

new LinkyStack(app, 'LinkyStack', {
  secretName,
  appUrl,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    // CloudFront and its future ACM certificate both want us-east-1.
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Linky serverless stack: HTTP API, Lambda, DynamoDB, S3 and CloudFront',
});
