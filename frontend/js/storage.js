/**
 * GlobalTrotter - Session Storage Helper
 * Manages active trip route and selected stops purely in browser session storage.
 * Strictly no fake users or authentication data.
 */

const STORAGE_KEY = 'globaltrotter_active_trip';

const Storage = {
  /**
   * Get current trip state from sessionStorage
   */
  getActiveTrip() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { fromCity: '', toCity: '', addedStops: [] };
    } catch (e) {
      console.warn('Unable to access sessionStorage:', e);
      return { fromCity: '', toCity: '', addedStops: [] };
    }
  },

  /**
   * Save trip state to sessionStorage
   */
  saveActiveTrip(tripData) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tripData));
    } catch (e) {
      console.warn('Unable to save to sessionStorage:', e);
    }
  },

  /**
   * Set Origin & Destination cities
   */
  setRoute(fromCity, toCity) {
    const trip = this.getActiveTrip();
    trip.fromCity = fromCity;
    trip.toCity = toCity;
    this.saveActiveTrip(trip);
  },

  /**
   * Add a stop to active trip
   */
  addStop(stop) {
    const trip = this.getActiveTrip();
    const exists = trip.addedStops.some(s => s.city.toLowerCase() === stop.city.toLowerCase());
    if (!exists) {
      trip.addedStops.push(stop);
      this.saveActiveTrip(trip);
    }
    return trip.addedStops;
  },

  /**
   * Remove a stop from active trip
   */
  removeStop(cityName) {
    const trip = this.getActiveTrip();
    trip.addedStops = trip.addedStops.filter(s => s.city.toLowerCase() !== cityName.toLowerCase());
    this.saveActiveTrip(trip);
    return trip.addedStops;
  },

  /**
   * Check if a stop is currently added
   */
  isStopAdded(cityName) {
    const trip = this.getActiveTrip();
    return trip.addedStops.some(s => s.city.toLowerCase() === cityName.toLowerCase());
  }
};
