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
   * Session / Authentication Helpers
   */
  getCurrentUser() {
    try {
      const userStr = sessionStorage.getItem('gt_auth_user') || localStorage.getItem('gt_auth_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      sessionStorage.setItem('gt_auth_user', JSON.stringify(user));
      localStorage.setItem('gt_auth_user', JSON.stringify(user));
    } else {
      this.clearCurrentUser();
    }
  },

  clearCurrentUser() {
    sessionStorage.removeItem('gt_auth_user');
    localStorage.removeItem('gt_auth_user');
  },

  logout() {
    this.clearCurrentUser();
    window.location.href = 'login.html';
  },

  async login(credentials) {
    const data = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (data && data.user) {
      this.setCurrentUser(data.user);
    }
    return data;
  },

  async register(userData) {
    const data = await this.request('/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (data && data.user) {
      this.setCurrentUser(data.user);
    }
    return data;
  },

  /**
   * Helper for standard JSON HTTP requests
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const user = this.getCurrentUser();
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(user && user.id ? { 'X-User-Id': String(user.id) } : {}),
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
          errorData = { error: `Request failed with status ${response.status}` };
        }
        const errorMsg = (errorData && (errorData.error || errorData.message)) || `HTTP ${response.status}`;
        throw new Error(errorMsg);
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
   * Retrieves list of trips for current authenticated user
   */
  async getTrips() {
    const user = this.getCurrentUser();
    const query = user && user.id ? `?user_id=${encodeURIComponent(user.id)}` : '';
    const res = await this.request(`/trips${query}`, { method: 'GET' });
    return Array.isArray(res) ? res : (res && res.trips ? res.trips : []);
  },

  /**
   * GET /api/trips/:id
   * Retrieves details of a specific trip
   */
  async getTripById(id) {
    const user = this.getCurrentUser();
    const query = user && user.id ? `?user_id=${encodeURIComponent(user.id)}` : '';
    return await this.request(`/trips/${encodeURIComponent(id)}${query}`, { method: 'GET' });
  },

  /**
   * POST /api/trips
   * Creates a new trip
   */
  async createTrip(tripData) {
    const user = this.getCurrentUser();
    const payload = {
      ...(tripData || {}),
      user_id: (tripData && tripData.user_id) || (user && user.id)
    };
    return await this.request('/trips', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * PUT /api/trips/:id
   * Updates an existing trip
   */
  async updateTrip(id, tripData) {
    const user = this.getCurrentUser();
    const payload = {
      ...(tripData || {}),
      user_id: (tripData && tripData.user_id) || (user && user.id)
    };
    return await this.request(`/trips/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  /**
   * DELETE /api/trips/:id
   * Deletes a trip
   */
  async deleteTrip(id) {
    const user = this.getCurrentUser();
    return await this.request(`/trips/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: user && user.id })
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
  // DESTINATIONS ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/trips/:id/destinations
   */
  async getDestinations(tripId) {
    const res = await this.request(`/trips/${encodeURIComponent(tripId)}/destinations`, { method: 'GET' });
    return (res && res.destinations) ? res.destinations : res;
  },

  /**
   * POST /api/trips/:id/destinations
   */
  async addDestination(tripId, destinationData) {
    const user = this.getCurrentUser();
    const payload = {
      ...(destinationData || {}),
      user_id: (destinationData && destinationData.user_id) || (user && user.id)
    };
    return await this.request(`/trips/${encodeURIComponent(tripId)}/destinations`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * PUT /api/destinations/:id
   */
  async updateDestination(destinationId, destinationData, tripId) {
    const user = this.getCurrentUser();
    const payload = {
      ...(destinationData || {}),
      user_id: (destinationData && destinationData.user_id) || (user && user.id)
    };
    const path = tripId
      ? `/trips/${encodeURIComponent(tripId)}/destinations/${encodeURIComponent(destinationId)}`
      : `/destinations/${encodeURIComponent(destinationId)}`;
    return await this.request(path, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  /**
   * DELETE /api/destinations/:id
   */
  async deleteDestination(destinationId, tripId) {
    const user = this.getCurrentUser();
    const path = tripId
      ? `/trips/${encodeURIComponent(tripId)}/destinations/${encodeURIComponent(destinationId)}`
      : `/destinations/${encodeURIComponent(destinationId)}`;
    return await this.request(path, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: user && user.id })
    });
  },

  // ==========================================================================
  // ITINERARY ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/trips/:id/itinerary
   * Gets itinerary activities for a trip
   */
  async getItinerary(tripId) {
    const res = await this.request(`/trips/${encodeURIComponent(tripId)}/itinerary`, { method: 'GET' });
    return (res && res.itinerary) ? res.itinerary : res;
  },

  /**
   * POST /api/trips/:id/itinerary
   * Adds an activity item to the trip itinerary
   */
  async addItineraryItem(tripId, itemData) {
    const user = this.getCurrentUser();
    const payload = {
      ...(itemData || {}),
      user_id: (itemData && itemData.user_id) || (user && user.id)
    };
    return await this.request(`/trips/${encodeURIComponent(tripId)}/itinerary`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * PUT /api/trips/:id/itinerary/:activityId
   * Updates an activity item
   */
  async updateItineraryItem(tripId, activityId, itemData) {
    const user = this.getCurrentUser();
    const payload = {
      ...(itemData || {}),
      user_id: (itemData && itemData.user_id) || (user && user.id)
    };
    return await this.request(`/trips/${encodeURIComponent(tripId)}/itinerary/${encodeURIComponent(activityId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  /**
   * DELETE /api/trips/:id/itinerary/:activityId
   * Deletes an activity item
   */
  async deleteItineraryItem(tripId, activityId) {
    const user = this.getCurrentUser();
    return await this.request(`/trips/${encodeURIComponent(tripId)}/itinerary/${encodeURIComponent(activityId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: user && user.id })
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
    const user = this.getCurrentUser();
    const payload = {
      ...(expenseData || {}),
      user_id: (expenseData && expenseData.user_id) || (user && user.id)
    };
    return await this.request(`/trips/${encodeURIComponent(tripId)}/expenses`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * PUT /api/trips/:id/expenses/:expenseId
   * Updates an expense record
   */
  async updateExpense(tripId, expenseId, expenseData) {
    const user = this.getCurrentUser();
    const payload = {
      ...(expenseData || {}),
      user_id: (expenseData && expenseData.user_id) || (user && user.id)
    };
    return await this.request(`/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  /**
   * DELETE /api/trips/:id/expenses/:expenseId
   * Deletes an expense record
   */
  async deleteExpense(tripId, expenseId) {
    const user = this.getCurrentUser();
    return await this.request(`/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: user && user.id })
    });
  },

  /**
   * PUT /api/trips/:id/budget
   * Updates trip total budget
   */
  async updateBudget(tripId, budget) {
    const user = this.getCurrentUser();
    return await this.request(`/trips/${encodeURIComponent(tripId)}/budget`, {
      method: 'PUT',
      body: JSON.stringify({
        budget,
        user_id: user && user.id
      })
    });
  },

  /**
   * GET /api/trips/:id/budget-summary
   */
  async getBudgetSummary(tripId) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/budget-summary`, { method: 'GET' });
  },

  // ==========================================================================
  // COLLABORATORS & SHARING ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/trips/:id/collaborators
   * Retrieves collaborators list for a trip
   */
  async getCollaborators(tripId) {
    const res = await this.request(`/trips/${encodeURIComponent(tripId)}/collaborators`, { method: 'GET' });
    return (res && res.collaborators) ? res.collaborators : res;
  },

  /**
   * POST /api/trips/:id/collaborators/invite
   * Invites a new collaborator to the trip
   */
  async inviteCollaborator(tripId, inviteData) {
    const user = this.getCurrentUser();
    const payload = {
      ...(inviteData || {}),
      user_id: (inviteData && inviteData.user_id) || (user && user.id)
    };
    return await this.request(`/trips/${encodeURIComponent(tripId)}/collaborators/invite`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * DELETE /api/trips/:id/collaborators/:collabId
   * Removes a collaborator from the trip
   */
  async removeCollaborator(tripId, collabId) {
    const user = this.getCurrentUser();
    return await this.request(`/trips/${encodeURIComponent(tripId)}/collaborators/${encodeURIComponent(collabId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: user && user.id })
    });
  },

  /**
   * POST /api/trips/:id/share
   * Creates or gets a share link token
   */
  async createShareLink(tripId) {
    return await this.request(`/trips/${encodeURIComponent(tripId)}/share`, {
      method: 'POST'
    });
  },

  /**
   * GET /api/shared-trips/:tokenOrId
   * Retrieves shared trip details for external viewers
   */
  async getSharedTrip(tokenOrId) {
    return await this.request(`/shared-trips/${encodeURIComponent(tokenOrId)}`, { method: 'GET' });
  }
};
