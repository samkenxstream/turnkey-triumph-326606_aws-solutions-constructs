/**
 *  Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import * as cognito from '@aws-cdk/aws-cognito';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { addCfnSuppressRules, consolidateProps } from './utils';
import { DefaultUserPoolProps, DefaultUserPoolClientProps, DefaultIdentityPoolProps } from './cognito-defaults';
// Note: To ensure CDKv2 compatibility, keep the import statement for Construct separate
import { Construct } from '@aws-cdk/core';

export interface CognitoOptions {
  readonly identitypool: cognito.CfnIdentityPool,
  readonly userpool: cognito.UserPool,
  readonly userpoolclient: cognito.UserPoolClient
}

export function buildUserPool(scope: Construct, userPoolProps?: cognito.UserPoolProps): cognito.UserPool {
  let cognitoUserPoolProps: cognito.UserPoolProps;

  cognitoUserPoolProps = consolidateProps(DefaultUserPoolProps, userPoolProps);

  const userPool = new cognito.UserPool(scope, 'CognitoUserPool', cognitoUserPoolProps);

  // Set the advancedSecurityMode to ENFORCED
  const cfnUserPool = userPool.node.findChild('Resource') as cognito.CfnUserPool;

  cfnUserPool.userPoolAddOns = {
    advancedSecurityMode: 'ENFORCED'
  };

  // Add Cfn Nag suppress for the cognito SMS role policy
  const userPoolSmsRole = userPool.node.tryFindChild('smsRole') as iam.Role;

  if (userPoolSmsRole) {
    addCfnSuppressRules(userPool, [
      {
        id: 'W11',
        reason: `Allowing * resource on permissions policy since its used by Cognito to send SMS messages via sns:Publish`
      }
    ]);
  }

  return userPool;
}

export function buildUserPoolClient(scope: Construct, userPool: cognito.UserPool,
  cognitoUserPoolClientProps?: cognito.UserPoolClientProps): cognito.UserPoolClient {

  let userPoolClientProps: cognito.UserPoolClientProps;

  userPoolClientProps = consolidateProps(DefaultUserPoolClientProps(userPool), cognitoUserPoolClientProps);

  return new cognito.UserPoolClient(scope, 'CognitoUserPoolClient', userPoolClientProps);
}

export function buildIdentityPool(scope: Construct, userpool: cognito.UserPool, userpoolclient: cognito.UserPoolClient,
  identityPoolProps?: cognito.CfnIdentityPoolProps): cognito.CfnIdentityPool {

  let cognitoIdentityPoolProps: cognito.CfnIdentityPoolProps = DefaultIdentityPoolProps(userpoolclient.userPoolClientId,
    userpool.userPoolProviderName);

  cognitoIdentityPoolProps = consolidateProps(cognitoIdentityPoolProps, identityPoolProps);

  const idPool = new cognito.CfnIdentityPool(scope, 'CognitoIdentityPool', cognitoIdentityPoolProps);

  return idPool;
}

export function setupCognitoForElasticSearch(scope: Construct, domainName: string, options: CognitoOptions): iam.Role {

  // Create the domain for Cognito UserPool
  const userpooldomain = new cognito.CfnUserPoolDomain(scope, 'UserPoolDomain', {
    domain: domainName,
    userPoolId: options.userpool.userPoolId
  });
  userpooldomain.addDependsOn(options.userpool.node.findChild('Resource') as cognito.CfnUserPool);

  // Setup the IAM Role for Cognito Authorized Users
  const cognitoPrincipal = new iam.FederatedPrincipal(
    'cognito-identity.amazonaws.com',
    {
      'StringEquals': { 'cognito-identity.amazonaws.com:aud': options.identitypool.ref },
      'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' }
    },
    'sts:AssumeRoleWithWebIdentity');

  const cognitoAuthorizedRole = new iam.Role(scope, 'CognitoAuthorizedRole', {
    assumedBy: cognitoPrincipal,
    inlinePolicies: {
      CognitoAccessPolicy: new iam.PolicyDocument({
        statements: [new iam.PolicyStatement({
          actions: [
            'es:ESHttp*'
          ],
          resources: [`arn:${cdk.Aws.PARTITION}:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/${domainName}/*`]
        })
        ]
      })
    }
  });

  // Attach the IAM Role for Cognito Authorized Users
  new cognito.CfnIdentityPoolRoleAttachment(scope, 'IdentityPoolRoleMapping', {
    identityPoolId: options.identitypool.ref,
    roles: {
      authenticated: cognitoAuthorizedRole.roleArn
    }
  });

  return cognitoAuthorizedRole;
}
