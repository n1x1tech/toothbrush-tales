import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'toothbrushTalesAudio',
  access: (allow) => ({
    // Audio files are stored per user (for future use)
    'audio/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
    // Public audio - Polly generated speech (accessible by anyone)
    'public/audio/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    // Other public sounds (brush reminders, celebration sounds)
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
    ],
  }),
});
