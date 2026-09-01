import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface LinkyStackProps extends cdk.StackProps {
  readonly secretName: string;
  readonly appUrl?: string;
}

const REPO_ROOT = path.join(__dirname, '..', '..');

export class LinkyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LinkyStackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------- data
    // Single table. pk is USER#<googleId>, so a cross-user access is not
    // expressible rather than merely guarded against.
    const table = new dynamodb.TableV2(this, 'LinksTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ------------------------------------------------------------- secrets
    // Referenced by name only. fromSecretNameV2 builds a wildcard ARN so the
    // grant survives the random suffix Secrets Manager appends.
    const secret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'AppSecret',
      props.secretName
    );

    // ------------------------------------------------------------- compute
    const apiFn = new nodejs.NodejsFunction(this, 'ApiFunction', {
      entry: path.join(REPO_ROOT, 'server', 'lambda.js'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      description: 'Linky API and OAuth handler',
      depsLockFilePath: path.join(REPO_ROOT, 'package-lock.json'),
      projectRoot: REPO_ROOT,
      bundling: {
        minify: true,
        sourceMap: true,
        format: nodejs.OutputFormat.CJS,
        target: 'node22',
        // Explicit rather than load-bearing: CDK already externalizes
        // @aws-sdk/* for Node 18+ runtimes, since the runtime ships SDK v3.
        // Stated here so the behaviour survives a CDK default change. The
        // remaining ~950 KB is Express baggage (mime-db, iconv-lite via
        // body-parser, semver via jsonwebtoken), not the SDK.
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--enable-source-maps',
        LINKY_TABLE_NAME: table.tableName,
        LINKY_SECRET_ID: props.secretName,
        ...(props.appUrl ? { APP_URL: props.appUrl } : {}),
      },
      logGroup: new logs.LogGroup(this, 'ApiFunctionLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    table.grantReadWriteData(apiFn);
    secret.grantRead(apiFn);

    // ----------------------------------------------------------------- api
    // HTTP API, not REST: nothing here needs WAF (that belongs on CloudFront
    // anyway), API keys, usage plans, request validation or response caching.
    // Payload format 2.0 is what makes the Set-Cookie handling work cleanly.
    // A $default route means Express owns all routing, and the $default stage
    // means the invoke URL carries no stage path segment to strip.
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'linky-api',
      description: 'Linky HTTP API fronting the Express application',
      defaultIntegration: new integrations.HttpLambdaIntegration(
        'DefaultIntegration',
        apiFn
      ),
    });

    // --------------------------------------------------------- static site
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Rebuildable from `npm run build`, unlike the table.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ------------------------------------------------------- edge functions
    const spaRewrite = new cloudfront.Function(this, 'SpaRewriteFunction', {
      code: cloudfront.FunctionCode.fromFile({
        filePath: path.join(__dirname, '..', 'cloudfront', 'spa-rewrite.js'),
      }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'Rewrite extensionless SPA routes to index.html',
    });

    const forwardedHost = new cloudfront.Function(this, 'ForwardedHostFunction', {
      code: cloudfront.FunctionCode.fromFile({
        filePath: path.join(__dirname, '..', 'cloudfront', 'forwarded-host.js'),
      }),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'Preserve the viewer host as x-forwarded-host for the API origin',
    });

    // --------------------------------------------------------- distribution
    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: new origins.HttpOrigin(cdk.Fn.parseDomainName(httpApi.apiEndpoint), {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      }),
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      // Nothing cached, so one user's authenticated response can never be
      // served to another.
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      // Forwards all cookies and query strings, and every header EXCEPT Host.
      // Host must be stripped or API Gateway rejects the request. Do not
      // change this to ALL_VIEWER.
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      functionAssociations: [
        {
          function: forwardedHost,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        },
      ],
      compress: true,
    };

    // NOTE: deliberately NO errorResponses here. See spa-rewrite.js.
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Linky single origin distribution for SPA and API',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: spaRewrite,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
        compress: true,
      },
      additionalBehaviors: {
        '/api/*': apiBehavior,
        '/auth/*': apiBehavior,
      },
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // minimumProtocolVersion is deliberately omitted: it has no effect while
      // the distribution uses the default CloudFront certificate. Set it
      // together with `certificate` when a custom domain is added.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // ------------------------------------------------------------- frontend
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(path.join(REPO_ROOT, 'client', 'dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    // -------------------------------------------------------------- outputs
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Public URL for the app',
    });
    new cdk.CfnOutput(this, 'GoogleRedirectUri', {
      value: `https://${distribution.distributionDomainName}/auth/google/callback`,
      description:
        'Add this to Authorized redirect URIs on the Google OAuth client',
    });
    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
    });
    new cdk.CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'ApiFunctionName', { value: apiFn.functionName });
    new cdk.CfnOutput(this, 'HttpApiEndpoint', { value: httpApi.apiEndpoint });
  }
}
