import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

// Define the story generation Lambda function
export const generateStoryFunction = defineFunction({
  name: 'generateStory',
  entry: './generateStory.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
});

// Define the text-to-speech Lambda function
export const synthesizeSpeechFunction = defineFunction({
  name: 'synthesizeSpeech',
  entry: './synthesizeSpeech.ts',
  timeoutSeconds: 60,
  memoryMB: 256,
});

const schema = a.schema({
  // Saved characters for quick selection
  Character: a
    .model({
      name: a.string().required(),
      isDefault: a.boolean().default(false),
      usageCount: a.integer().default(0),
    })
    .authorization((allow) => [allow.owner()]),

  // Generated stories
  Story: a
    .model({
      characterName: a.string().required(),
      theme: a.string().required(),
      intro: a.string().required(),
      segments: a.string().array().required(),
      brushingPrompts: a.string().array().required(),
      conclusion: a.string().required(),
      audioUrl: a.string(),
      isFavorite: a.boolean().default(false),
      playbackCount: a.integer().default(0),
    })
    .authorization((allow) => [allow.owner(), allow.guest().to(['read'])]),

  // User settings/preferences
  UserSettings: a
    .model({
      visitorId: a.string().required(),
      voiceId: a.string().default('Joanna'),
      playbackMode: a.enum(['audio', 'text', 'both']),
      defaultCharacterName: a.string(),
    })
    .authorization((allow) => [allow.owner()]),

  // Custom query to generate a story using Bedrock
  generateStory: a
    .query()
    .arguments({
      characterName: a.string().required(),
      theme: a.string().required(),
    })
    .returns(a.ref('Story'))
    .handler(a.handler.function(generateStoryFunction))
    .authorization((allow) => [allow.authenticated(), allow.guest()]),

  // Custom query to synthesize speech using Polly
  synthesizeSpeech: a
    .query()
    .arguments({
      text: a.string().required(),
      voiceId: a.string(),
    })
    .returns(a.string())
    .handler(a.handler.function(synthesizeSpeechFunction))
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
});
