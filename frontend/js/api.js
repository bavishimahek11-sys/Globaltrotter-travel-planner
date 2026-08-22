/**
 * GlobalTrotter - API Client (Phase 7 Final Clean Architecture)
 * Centralized API service for communicating with the backend REST endpoints.
 *
 * NOTE: Strictly no localStorage/sessionStorage database logic.
 * Strictly no mock or fake data.
 */

const API_BASE_URL = '/api';

const API = {
  /**
   * Helper for standard JSON HTTP requests
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (_) {
          errorData = { message: `Request failed with status ${response.status}` };
        }
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn(`API Error on [${options.method || 'GET'}] ${endpoint}:`, error.message);
      throw error;
    }
  },

  // ==========================================================================
  // TRIPS ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/trips
   * Retrieves list of all trips
   */
  async getTrips() {
    return await this.request('/trips', { method: 'GET' });
  },

  /**
   * GET /api/trips/:id
   * Retrieves details of a specific trip
   */
  async getTripById(id) {
    return await this.request(`/trips/${encodeURIComponent(id)}`, { method: 'GET' });
  },

  /**
   * POST /api/trips
   * Creates a new trip
   */
  async createTrip(tripData) {
    return await this.request('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData)
    });
  },

  /**
   * PUT /api/trips/:id
   * Updates an existing trip
   */
  async updateTrip(id, tripData) {
    return await this.request(`/trips/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(tripData)
    });
  },

  /**
   * DELETE /api/trips/:id
   * Deletes a trip
   */
  async deleteTrip(id) {
    return await this.request(`/trips/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  // ==========================================================================
  // SMART STOPS ENDPOINT
  // ==========================================================================

  /**
   * GET /api/smart-stops?from=...&to=...
   * Fetches curated intermediate stops between two cities
   */
  async getSmartStops(fromCity, toCity) {
    const params = new URLSearchParams({
      from: fromCity.trim(),
      to: toCity.trim()
    });
    return await this.request(`/smart-stops?${params.toString()}`, { method: 'GET' });
  },

  // ==========================================================================
  // ITINERARY ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/trips/:id/itinerary
   * Gets itinerary activities for a trip
   */
  async getItinerary(tripId) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/itinerary`, { method: 'GET' });
  },

  /**
   * POST /api/trips/:id/itinerary
   * Adds an activity item to the trip itinerary
   */
  async addItineraryItem(tripId, itemData) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/itinerary`, {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },

  /**
   * PUT /api/trips/:id/itinerary/:activityId
   * Updates an activity item
   */
  async updateItineraryItem(tripId, activityId, itemData) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/itinerary/${encodeURIComponent(activityId)}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  },

  /**
   * DELETE /api/trips/:id/itinerary/:activityId
   * Deletes an activity item
   */
  async deleteItineraryItem(tripId, activityId) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/itinerary/${encodeURIComponent(activityId)}`, {
      method: 'DELETE'
    });
  },

  // ==========================================================================
  // EXPENSES & BUDGET ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/trips/:id/expenses
   * Retrieves all expenses for a trip
   */
  async getExpenses(tripId) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/expenses`, { method: 'GET' });
  },

  /**
   * POST /api/trips/:id/expenses
   * Adds an expense record
   */
  async addExpense(tripId, expenseData) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/expenses`, {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });
  },

  /**
   * PUT /api/trips/:id/expenses/:expenseId
   * Updates an expense record
   */
  async updateExpense(tripId, expenseId, expenseData) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'PUT',
      body: JSON.stringify(expenseData)
    });
  },

  /**
   * DELETE /api/trips/:id/expenses/:expenseId
   * Deletes an expense record
   */
  async deleteExpense(tripId, expenseId) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'DELETE'
    });
  },

  // ==========================================================================
  // COLLABORATORS & SHARING ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/trips/:id/collaborators
   * Retrieves collaborators list for a trip
   */
  async getCollaborators(tripId) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/collaborators`, { method: 'GET' });
  },

  /**
   * POST /api/trips/:id/collaborators/invite
   * Invites a new collaborator to the trip
   */
  async inviteCollaborator(tripId, inviteData) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/collaborators/invite`, {
      method: 'POST',
      body: JSON.stringify(inviteData)
    });
  },

  /**
   * DELETE /api/trips/:id/collaborators/:collabId
   * Removes a collaborator from the trip
   */
  async removeCollaborator(tripId, collabId) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/collaborators/${encodeURIComponent(collabId)}`, {
      method: 'DELETE'
    });
  },

  /**
   * GET /api/shared/trips/:id
   * Retrieves shared trip details for external viewers
   */
  async getSharedTrip(id) {
    return await this.request(`/shared/trips/${encodeURIComponent(id)}`, { method: 'GET' });
  }
};
