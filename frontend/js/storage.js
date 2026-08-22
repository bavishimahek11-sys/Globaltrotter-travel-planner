/**
 * GlobalTrotter - Storage Helper (Phases 1, 3, 4, 5 & 6)
 * Manages active trip route, user-created trips, itineraries, expenses,
 * and collaborators in browser storage.
 * Strictly no fake users, fake trips, or hardcoded sample data.
 */

const ACTIVE_TRIP_KEY = 'globaltrotter_active_trip';
const TRIPS_LIST_KEY = 'globaltrotter_user_trips';

const Storage = {
  // ==========================================================================
  // ACTIVE SESSION TRIP
  // ==========================================================================
  
  /**
   * Get current active trip state from sessionStorage
   */
  getActiveTrip() {
    try {
      const data = sessionStorage.getItem(ACTIVE_TRIP_KEY);
      return data ? JSON.parse(data) : { 
        id: 'active',
        title: '',
        destination: '',
        fromCity: '', 
        toCity: '', 
        startDate: '',
        endDate: '',
        budget: '',
        duration: '',
        addedStops: [],
        itinerary: [],
        expenses: [],
        collaborators: []
      };
    } catch (e) {
      console.warn('Unable to access sessionStorage:', e);
      return { 
        id: 'active',
        title: '',
        destination: '',
        fromCity: '', 
        toCity: '', 
        startDate: '',
        endDate: '',
        budget: '',
        duration: '',
        addedStops: [],
        itinerary: [],
        expenses: [],
        collaborators: []
      };
    }
  },

  /**
   * Save active trip state to sessionStorage
   */
  saveActiveTrip(tripData) {
    try {
      sessionStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(tripData));
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
    if (!trip.destination && toCity) {
      trip.destination = toCity;
    }
    if (!trip.title && fromCity && toCity) {
      trip.title = `Trip from ${fromCity} to ${toCity}`;
    }
    this.saveActiveTrip(trip);
  },

  /**
   * Add a stop to active trip
   */
  addStop(stop) {
    const trip = this.getActiveTrip();
    if (!trip.addedStops) trip.addedStops = [];
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
    if (!trip.addedStops) trip.addedStops = [];
    trip.addedStops = trip.addedStops.filter(s => s.city.toLowerCase() !== cityName.toLowerCase());
    this.saveActiveTrip(trip);
    return trip.addedStops;
  },

  /**
   * Check if a stop is currently added
   */
  isStopAdded(cityName) {
    const trip = this.getActiveTrip();
    if (!trip.addedStops) return false;
    return trip.addedStops.some(s => s.city.toLowerCase() === cityName.toLowerCase());
  },

  // ==========================================================================
  // SAVED TRIPS LIST
  // ==========================================================================

  /**
   * Get all user saved trips from localStorage (empty array if none exist)
   */
  getTrips() {
    try {
      const data = localStorage.getItem(TRIPS_LIST_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Unable to access localStorage:', e);
      return [];
    }
  },

  /**
   * Save trips array to localStorage
   */
  saveTripsList(trips) {
    try {
      localStorage.setItem(TRIPS_LIST_KEY, JSON.stringify(trips));
    } catch (e) {
      console.warn('Unable to save trips to localStorage:', e);
    }
  },

  /**
   * Get a single trip by ID (or falls back to active session trip)
   */
  getTripById(id) {
    if (!id || id === 'active') {
      const active = this.getActiveTrip();
      if (active.fromCity || active.toCity || active.title) return active;
    }
    const trips = this.getTrips();
    const found = trips.find(t => String(t.id) === String(id));
    if (found) return found;

    const active = this.getActiveTrip();
    return active;
  },

  /**
   * Save or update a trip
   */
  saveTrip(tripData) {
    const trips = this.getTrips();
    if (!tripData.id || tripData.id === 'active') {
      tripData.id = 'trip_' + Date.now();
    }
    if (!tripData.itinerary) {
      tripData.itinerary = [];
    }
    if (!tripData.expenses) {
      tripData.expenses = [];
    }
    if (!tripData.collaborators) {
      tripData.collaborators = [];
    }

    const index = trips.findIndex(t => String(t.id) === String(tripData.id));
    if (index >= 0) {
      trips[index] = tripData;
    } else {
      trips.push(tripData);
    }
    this.saveTripsList(trips);
    this.saveActiveTrip(tripData);
    return tripData;
  },

  /**
   * Delete a trip by ID
   */
  deleteTrip(id) {
    let trips = this.getTrips();
    trips = trips.filter(t => String(t.id) !== String(id));
    this.saveTripsList(trips);
  },

  // ==========================================================================
  // ITINERARY CRUD OPERATIONS
  // ==========================================================================

  /**
   * Add an activity item to a trip's itinerary
   */
  addItineraryItem(tripId, item) {
    const trip = this.getTripById(tripId);
    if (!trip) return null;

    if (!trip.itinerary) trip.itinerary = [];
    item.id = 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    trip.itinerary.push(item);

    this.saveTrip(trip);
    return item;
  },

  /**
   * Update an existing activity item in a trip's itinerary
   */
  updateItineraryItem(tripId, itemId, updatedData) {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.itinerary) return null;

    const index = trip.itinerary.findIndex(i => String(i.id) === String(itemId));
    if (index >= 0) {
      trip.itinerary[index] = { ...trip.itinerary[index], ...updatedData };
      this.saveTrip(trip);
      return trip.itinerary[index];
    }
    return null;
  },

  /**
   * Delete an activity item from a trip's itinerary
   */
  deleteItineraryItem(tripId, itemId) {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.itinerary) return false;

    trip.itinerary = trip.itinerary.filter(i => String(i.id) !== String(itemId));
    this.saveTrip(trip);
    return true;
  },

  // ==========================================================================
  // EXPENSE & BUDGET CRUD OPERATIONS (PHASE 4)
  // ==========================================================================

  /**
   * Get all expenses for a trip
   */
  getTripExpenses(tripId) {
    const trip = this.getTripById(tripId);
    return (trip && trip.expenses) ? trip.expenses : [];
  },

  /**
   * Add an expense record to a trip
   */
  addExpense(tripId, expense) {
    const trip = this.getTripById(tripId);
    if (!trip) return null;

    if (!trip.expenses) trip.expenses = [];
    expense.id = 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    expense.amount = Number(expense.amount) || 0;
    trip.expenses.push(expense);

    this.saveTrip(trip);
    return expense;
  },

  /**
   * Update an existing expense record in a trip
   */
  updateExpense(tripId, expenseId, updatedData) {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.expenses) return null;

    const index = trip.expenses.findIndex(e => String(e.id) === String(expenseId));
    if (index >= 0) {
      if (updatedData.amount !== undefined) {
        updatedData.amount = Number(updatedData.amount) || 0;
      }
      trip.expenses[index] = { ...trip.expenses[index], ...updatedData };
      this.saveTrip(trip);
      return trip.expenses[index];
    }
    return null;
  },

  /**
   * Delete an expense record from a trip
   */
  deleteExpense(tripId, expenseId) {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.expenses) return false;

    trip.expenses = trip.expenses.filter(e => String(e.id) !== String(expenseId));
    this.saveTrip(trip);
    return true;
  },

  // ==========================================================================
  // COLLABORATION CRUD OPERATIONS (PHASE 6)
  // ==========================================================================

  /**
   * Get all collaborators for a trip
   */
  getTripCollaborators(tripId) {
    const trip = this.getTripById(tripId);
    return (trip && trip.collaborators) ? trip.collaborators : [];
  },

  /**
   * Add a collaborator to a trip
   */
  addCollaborator(tripId, collaborator) {
    const trip = this.getTripById(tripId);
    if (!trip) return null;

    if (!trip.collaborators) trip.collaborators = [];
    const exists = trip.collaborators.some(c => c.email.toLowerCase() === collaborator.email.toLowerCase());
    if (exists) return { error: 'Collaborator already added with this email.' };

    collaborator.id = 'collab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    collaborator.role = collaborator.role || 'Viewer';
    trip.collaborators.push(collaborator);

    this.saveTrip(trip);
    return collaborator;
  },

  /**
   * Remove a collaborator from a trip
   */
  removeCollaborator(tripId, collaboratorId) {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.collaborators) return false;

    trip.collaborators = trip.collaborators.filter(c => String(c.id) !== String(collaboratorId));
    this.saveTrip(trip);
    return true;
  }
};
