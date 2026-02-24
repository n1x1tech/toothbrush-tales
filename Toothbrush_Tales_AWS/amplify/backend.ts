import { defineBackend } from '@aws-amplify/backend';
import { Duration } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
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
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-7-sonnet-*',
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
const generateLambda = backend.generateStoryFunction.resources.lambda as Function;

// CloudWatch alarms for core function reliability
new Alarm(generateLambda, 'GenerateStoryErrorsAlarm', {
  alarmDescription: 'Alerts when story generation Lambda returns errors',
  metric: generateLambda.metricErrors({ period: Duration.minutes(5) }),
  threshold: 1,
  evaluationPeriods: 1,
  comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  treatMissingData: TreatMissingData.NOT_BREACHING,
});

new Alarm(generateLambda, 'GenerateStoryLatencyAlarm', {
  alarmDescription: 'Alerts on elevated story generation latency',
  metric: generateLambda.metricDuration({
    period: Duration.minutes(5),
    statistic: 'p95',
  }),
  threshold: 10000,
  evaluationPeriods: 2,
  comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  treatMissingData: TreatMissingData.NOT_BREACHING,
});

new Alarm(synthesizeLambda, 'SynthesizeSpeechErrorsAlarm', {
  alarmDescription: 'Alerts when TTS Lambda returns errors',
  metric: synthesizeLambda.metricErrors({ period: Duration.minutes(5) }),
  threshold: 1,
  evaluationPeriods: 1,
  comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  treatMissingData: TreatMissingData.NOT_BREACHING,
});

new Alarm(synthesizeLambda, 'SynthesizeSpeechLatencyAlarm', {
  alarmDescription: 'Alerts on elevated TTS latency',
  metric: synthesizeLambda.metricDuration({
    period: Duration.minutes(5),
    statistic: 'p95',
  }),
  threshold: 8000,
  evaluationPeriods: 2,
  comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  treatMissingData: TreatMissingData.NOT_BREACHING,
});

export default backend;
