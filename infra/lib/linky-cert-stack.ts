import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

export interface LinkyCertStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly hostedZoneId: string;
  readonly hostedZoneName: string;
}

/**
 * CloudFront only accepts viewer certificates from us-east-1, but the main
 * stack lives in us-west-2. This stack exists solely to hold the certificate
 * in the right region; the ARN crosses regions via crossRegionReferences.
 */
export class LinkyCertStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: LinkyCertStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName,
    });

    // fromDns writes the validation CNAME into the hosted zone automatically,
    // so issuance needs no manual step. DnsValidatedCertificate is deprecated;
    // Certificate + CertificateValidation.fromDns is the supported path.
    this.certificate = new acm.Certificate(this, 'SiteCert', {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
    });
  }
}
