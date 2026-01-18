import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'toothbrushTalesAudio',
  access: (allow) => ({
    // Audio files are stored per user
    'audio/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
    // Public sounds (brush reminders, celebration sounds)
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
    ],
  }),
});
