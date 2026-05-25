import * as admin from 'firebase-admin'

admin.initializeApp()

export { onStoryRequest } from './generateStory'
export { onTTSRequest } from './synthesizeSpeech'
