/**
 * GlobalTrotter - Client Storage Helper (Clean Architecture)
 *
 * NOTE: As per Phase 7 requirements, all application data (users, trips, expenses,
 * itineraries, collaborators) is fetched and managed through the real backend API (API client).
 * LocalStorage / SessionStorage is NOT used as an application database or mock storage.
 */

// Export an empty safe interface or redirect calls if referenced
const Storage = {
  // Application records are managed strictly via API.js
};
