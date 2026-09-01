#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LinkyStack } from '../lib/linky-stack';
import { LinkyCertStack } from '../lib/linky-cert-stack';

const app = new cdk.App();

// Name of the Secrets Manager secret holding GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET and JWT_SECRET. Created out of band; this stack only
// references it and never reads its value.
const secretName = app.node.tryGetContext('secretName') || 'linky/prod';

// Optional explicit public origin. Left unset, the Lambda derives it from the
// x-forwarded-host header injected by a CloudFront Function, so it follows
// whatever domain the request arrived on.
const appUrl = app.node.tryGetContext('appUrl');

// Custom domain. Pass -c domainName= (empty) to deploy without one.
const domainName = app.node.tryGetContext('domainName') ?? 'linky.codenut.com';
const hostedZoneId = app.node.tryGetContext('hostedZoneId') ?? 'Z1X12TLGS0JP9R';
const hostedZoneName = app.node.tryGetContext('hostedZoneName') ?? 'codenut.com';

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-west-2';

// CloudFront requires its viewer certificate in us-east-1, regardless of where
// the rest of the stack lives.
const certStack = domainName
  ? new LinkyCertStack(app, 'LinkyCertStack', {
      env: { account, region: 'us-east-1' },
      crossRegionReferences: true,
      domainName,
      hostedZoneId,
      hostedZoneName,
      description: 'Linky CloudFront viewer certificate (us-east-1)',
    })
  : undefined;

new LinkyStack(app, 'LinkyStack', {
  secretName,
  appUrl,
  domainName: domainName || undefined,
  certificate: certStack?.certificate,
  hostedZoneId: domainName ? hostedZoneId : undefined,
  hostedZoneName: domainName ? hostedZoneName : undefined,
  crossRegionReferences: true,
  env: { account, region },
  description:
    'Linky serverless stack: HTTP API, Lambda, DynamoDB, S3 and CloudFront',
});
