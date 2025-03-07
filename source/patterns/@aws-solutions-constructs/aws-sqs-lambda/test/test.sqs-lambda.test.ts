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

// Imports
import { Stack } from "@aws-cdk/core";
import { SqsToLambda, SqsToLambdaProps } from "../lib";
import * as lambda from '@aws-cdk/aws-lambda';
import '@aws-cdk/assert/jest';

// --------------------------------------------------------------
// Pattern deployment w/ new Lambda function and
// overridden properties
// --------------------------------------------------------------
test('Pattern deployment w/ new Lambda function and overridden props', () => {
  // Initial Setup
  const stack = new Stack();
  const props: SqsToLambdaProps = {
    lambdaFunctionProps: {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`${__dirname}/lambda`),
      environment: {
        OVERRIDE: "TRUE"
      }
    },
    queueProps: {
      fifo: true
    },
    deployDeadLetterQueue: false,
    maxReceiveCount: 0
  };
  const app = new SqsToLambda(stack, 'test-sqs-lambda', props);
  // Assertion 1
  expect(app.sqsQueue).toHaveProperty('fifo', true);
  // Assertion 2
  expect(stack).toHaveResource('AWS::Lambda::Function', {
    Environment: {
      Variables: {
        OVERRIDE: "TRUE",
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1"
      }
    }
  });
});

// --------------------------------------------------------------
// Test the getter methods
// --------------------------------------------------------------
test('Test getter methods', () => {
  // Initial Setup
  const stack = new Stack();
  const props: SqsToLambdaProps = {
    lambdaFunctionProps: {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`${__dirname}/lambda`)
    },
    deployDeadLetterQueue: true,
    maxReceiveCount: 0,
    queueProps: {}
  };
  const app = new SqsToLambda(stack, 'test-apigateway-lambda', props);
  // Assertion 1
  expect(app.lambdaFunction !== null);
  // Assertion 2
  expect(app.sqsQueue !== null);
  // Assertion 3
  expect(app.deadLetterQueue !== null);
});

// --------------------------------------------------------------
// Test error handling for existing Lambda function
// --------------------------------------------------------------
test('Test error handling for existing Lambda function', () => {
  // Initial Setup
  const stack = new Stack();
  const props: SqsToLambdaProps = {
    existingLambdaObj: undefined,
    deployDeadLetterQueue: false,
    maxReceiveCount: 0,
    queueProps: {}
  };
    // Assertion 1
  expect(() => {
    new SqsToLambda(stack, 'test-sqs-lambda', props);
  }).toThrowError();
});

// --------------------------------------------------------------
// Test error handling for new Lambda function
// w/o required properties
// --------------------------------------------------------------
test('Test error handling for new Lambda function w/o required properties', () => {
  // Initial Setup
  const stack = new Stack();
  const props: SqsToLambdaProps = {
    deployDeadLetterQueue: false,
    maxReceiveCount: 0,
    queueProps: {}
  };
    // Assertion 1
  expect(() => {
    new SqsToLambda(stack, 'test-sqs-lambda', props);
  }).toThrowError();
});

// --------------------------------------------------------------
// Pattern deployment w/ batch size
// --------------------------------------------------------------
test('Pattern deployment w/ batch size', () => {
  const stack = new Stack();
  const props: SqsToLambdaProps = {
    lambdaFunctionProps: {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(`${__dirname}/lambda`),
    },
    sqsEventSourceProps: {
      batchSize: 5
    }
  };
  new SqsToLambda(stack, 'test-sqs-lambda', props);

  expect(stack).toHaveResource('AWS::Lambda::EventSourceMapping', {
    BatchSize: 5
  });
});