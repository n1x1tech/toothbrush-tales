import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data, generateStoryFunction, synthesizeSpeechFunction } from './data/resource';
import { storage } from './storage/resource';

/**
 * Toothbrush Tales Backend
 * - Auth: Cognito for user accounts
 * - Data: DynamoDB for stories/characters + AppSync API
 * - Storage: S3 for audio files
 * - Functions: Lambda for Bedrock (story gen) and Polly (TTS)
 */
const backend = defineBackend({
  auth,
  data,
  storage,
  generateStoryFunction,
  synthesizeSpeechFunction,
});

// Get the S3 bucket for audio storage
const storageBucket = backend.storage.resources.bucket;

// Add Bedrock permissions to the story generation Lambda
backend.generateStoryFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-*',
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-*',
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-instant-*',
    ],
  })
);

// Add Polly and S3 permissions to the speech synthesis Lambda
backend.synthesizeSpeechFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['polly:SynthesizeSpeech'],
    resources: ['*'],
  })
);

backend.synthesizeSpeechFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:PutObject', 's3:GetObject'],
    resources: [`${storageBucket.bucketArn}/*`],
  })
);

// Pass the bucket name to the TTS Lambda as an environment variable
const synthesizeLambda = backend.synthesizeSpeechFunction.resources.lambda as Function;
synthesizeLambda.addEnvironment('STORAGE_BUCKET_NAME', storageBucket.bucketName);

export default backend;
