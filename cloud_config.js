/* Hue & Seek — Cloud save configuration (Firebase: anonymous sign-in + Firestore).
 *
 * These values identify the Firebase project; they are public client identifiers (they ship inside every
 * build) and are not secrets. What protects the data is the Firestore security rules, kept in
 * `tools/firestore.rules` and published in the Firebase console.
 *
 * Set `enabled: false` to turn cloud save off; the game then keeps saving on the device only.
 */
export const CLOUD_CONFIG = {
  enabled: true,
  apiKey: 'AIzaSyC5HgOEvHiSwqum2rjGp9e7ljtU27lGrig',
  projectId: 'project-24-431519',
  collection: 'saves',
};
