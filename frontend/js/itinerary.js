/**
 * GlobalTrotter - Trip Details & Itinerary Page JS (Phase 3)
 *
 * Manages rendering of dynamic trip details, grouped day-by-day activities,
 * activity creation/editing/deletion, and modal interaction.
 *
 * NOTE: Strictly no fake users, no fake trips, and no hardcoded demo activities.
 *
 * ============================================================================
 * EXPECTED BACKEND REST API SPECIFICATION (For Future Backend Integration)
 * ============================================================================
 * 
 * 1. Get Trip Details with Itinerary:
 *    GET /api/trips/:id
 *    Response: {
 *      id: "trip_123",
 *      title: "Mumbai Coastal Getaway",
 *      destination: "Mumbai",
 *      fromCity: "Ahmedabad",
 *      toCity: "Mumbai",
 *      startDate: "2026-09-10",
 *      endDate: "2026-09-14",
 *      budget: 15000,
 *      duration: "5 days",
 *      addedStops: [{ city: "Vadodara", category: "Heritage • Food", duration: "4–6 hours" }],
 *      itinerary: [
 *        { id: "act_1", date: "2026-09-10", time: "09:00", activity: "Palace Visit", location: "Vadodara", notes: "Sightseeing" }
 *      ]
 *    }
 *
 * 2. Add Itinerary Activity:
 *    POST /api/trips/:id/itinerary
 *    Body: { date: "2026-09-10", time: "09:00", activity: "Palace Visit", location: "Vadodara", notes: "Sightseeing" }
 *    Response: 201 Created -> { id: "act_1", ... }
 *
 * 3. Update Itinerary Activity:
 *    PUT /api/trips/:id/itinerary/:activityId
 *    Body: { date: "2026-09-10", time: "10:00", activity: "Updated Activity", location: "Vadodara", notes: "Updated notes" }
 *    Response: 200 OK -> { id: "act_1", ... }
 *
 * 4. Delete Itinerary Activity:
 *    DELETE /api/trips/:id/itinerary/:activityId
 *    Response: 204 No Content
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tripSummaryCard = document.getElementById('tripSummaryCard');
  const itineraryDaysContainer = document.getElementById('itineraryDaysContainer');
  const pageHeroTitle = document.getElementById('pageHeroTitle');
  const pageAlertContainer = document.getElementById('pageAlertContainer');
  
  // Modal Elements
  const activityModal = document.getElementById('activityModal');
  const openAddActivityBtn = document.getElementById('openAddActivityBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const activityForm = document.getElementById('activityForm');
  const modalTitle = document.getElementById('modalTitle');
  const modalAlertContainer = document.getElementById('modalAlertContainer');
  const editingActivityIdInput = document.getElementById('editingActivityId');
  const activityDateInput = document.getElementById('activityDate');
  const activityTimeInput = document.getElementById('activityTime');
  const activityNameInput = document.getElementById('activityName');
  const activityLocationInput = document.getElementById('activityLocation');
  const activityNotesInput = document.getElementById('activityNotes');
  const saveActivitySubmitBtn = document.getElementById('saveActivitySubmitBtn');

  // 1. Get Target Trip
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get('id') || 'active';
  let currentTrip = Storage.getTripById(tripId);

  // Initialize Page
  renderTripDetails();
  renderItinerary();
  setupEventListeners();

  // ==========================================================================
  // RENDER TRIP DETAILS SUMMARY
  // ==========================================================================
  function renderTripDetails() {
    if (!tripSummaryCard) return;

    if (!currentTrip || (!currentTrip.fromCity && !currentTrip.toCity && !currentTrip.title)) {
      tripSummaryCard.innerHTML = `
        <div class="state-box" style="padding: 2rem;">
          <span class="state-icon">🎒</span>
          <div class="state-title">No Trip Selected</div>
          <div class="state-desc">You haven't configured a trip yet. Create a new trip or choose one from your saved trips.</div>
          <div style="margin-top: 1.25rem;">
            <a href="create-trip.html" class="btn btn-primary">Plan a Trip</a>
          </div>
        </div>
      `;
      if (openAddActivityBtn) openAddActivityBtn.style.display = 'none';
      return;
    }

    if (openAddActivityBtn) openAddActivityBtn.style.display = 'inline-flex';

    const title = currentTrip.title || `Trip to ${currentTrip.toCity || currentTrip.destination || 'Destination'}`;
    const destination = currentTrip.destination || (currentTrip.fromCity && currentTrip.toCity ? `${currentTrip.fromCity} ➔ ${currentTrip.toCity}` : 'Custom Destination');
    const dateRange = (currentTrip.startDate && currentTrip.endDate) 
      ? `${formatDate(currentTrip.startDate)} – ${formatDate(currentTrip.endDate)}` 
      : (currentTrip.startDate ? formatDate(currentTrip.startDate) : 'Dates flexible');
    const duration = currentTrip.duration || 'Flexible duration';
    const budget = currentTrip.budget ? `₹${Number(currentTrip.budget).toLocaleString()}` : 'Not specified';
    const stopsCount = currentTrip.addedStops ? currentTrip.addedStops.length : 0;

    if (pageHeroTitle) {
      pageHeroTitle.textContent = title;
    }

    tripSummaryCard.innerHTML = `
      <div class="trip-details-top">
        <div class="trip-details-title-box">
          <h1>${escapeHtml(title)}</h1>
          <div class="trip-destination-pill">
            <span>📍</span> ${escapeHtml(destination)}
          </div>
        </div>
        <div>
          <a href="trips.html" class="btn btn-sm btn-outline">
            <span>←</span> All Trips
          </a>
        </div>
      </div>

      <div class="trip-stats-grid">
        <div class="stat-card">
          <span class="stat-label">Travel Dates</span>
          <span class="stat-value">🗓️ ${dateRange}</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Duration</span>
          <span class="stat-value">⏱️ ${escapeHtml(duration)}</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Estimated Budget</span>
          <span class="stat-value">💰 ${budget}</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Smart Stops</span>
          <span class="stat-value">✨ ${stopsCount} intermediate ${stopsCount === 1 ? 'stop' : 'stops'}</span>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // RENDER ITINERARY ACTIVITIES (GROUPED BY DAY / DATE)
  // ==========================================================================
  function renderItinerary() {
    if (!itineraryDaysContainer) return;

    // Refresh current trip state
    currentTrip = Storage.getTripById(tripId);

    if (!currentTrip || (!currentTrip.fromCity && !currentTrip.toCity && !currentTrip.title)) {
      itineraryDaysContainer.innerHTML = '';
      return;
    }

    const activities = currentTrip.itinerary || [];

    // Empty state
    if (activities.length === 0) {
      itineraryDaysContainer.innerHTML = `
        <div class="state-box">
          <span class="state-icon">📋</span>
          <div class="state-title">No activities planned yet.</div>
          <div class="state-desc">Your itinerary is currently empty. Start building your schedule by adding sights, tours, meal stops, or hotel check-ins.</div>
          <button type="button" class="btn btn-primary btn-add-first-activity">
            <span>+</span> Add Activity
          </button>
        </div>
      `;

      const addFirstBtn = itineraryDaysContainer.querySelector('.btn-add-first-activity');
      if (addFirstBtn) {
        addFirstBtn.addEventListener('click', openAddModal);
      }
      return;
    }

    // Group activities by date
    const grouped = groupActivitiesByDate(activities);
    const sortedDates = Object.keys(grouped).sort();

    let html = '';
    sortedDates.forEach((dateKey, index) => {
      const dayNumber = index + 1;
      const formattedDate = dateKey === 'unspecified' ? 'Flexible Date' : formatDateLong(dateKey);
      const dayActivities = grouped[dateKey];

      // Sort day activities by time
      dayActivities.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      html += `
        <div class="day-group">
          <div class="day-header">
            <span class="day-badge">Day ${dayNumber}</span>
            <h3 class="day-title">${formattedDate}</h3>
          </div>

          <div class="activities-list">
      `;

      dayActivities.forEach(item => {
        const timeDisplay = item.time ? formatTime(item.time) : 'Flexible Time';

        html += `
          <div class="activity-card" data-id="${escapeHtml(item.id)}">
            <div class="activity-main">
              <div class="activity-time">
                <span>⏰</span> ${escapeHtml(timeDisplay)}
              </div>
              <h4 class="activity-name">${escapeHtml(item.activity)}</h4>
              <div class="activity-location">
                <span>📍</span> ${escapeHtml(item.location)}
              </div>
              ${item.notes ? `<div class="activity-notes">${escapeHtml(item.notes)}</div>` : ''}
            </div>

            <div class="activity-actions">
              <button type="button" class="btn-icon btn-edit-activity" data-id="${escapeHtml(item.id)}" title="Edit activity">
                <span>✏️</span> Edit
              </button>
              <button type="button" class="btn-icon btn-icon-danger btn-delete-activity" data-id="${escapeHtml(item.id)}" title="Delete activity">
                <span>🗑️</span> Delete
              </button>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    itineraryDaysContainer.innerHTML = html;

    // Attach Event Listeners to Edit and Delete Buttons
    itineraryDaysContainer.querySelectorAll('.btn-edit-activity').forEach(btn => {
      btn.addEventListener('click', () => {
        const actId = btn.getAttribute('data-id');
        openEditModal(actId);
      });
    });

    itineraryDaysContainer.querySelectorAll('.btn-delete-activity').forEach(btn => {
      btn.addEventListener('click', () => {
        const actId = btn.getAttribute('data-id');
        handleDeleteActivity(actId);
      });
    });
  }

  // ==========================================================================
  // MODAL & FORM INTERACTIONS (ADD / EDIT / DELETE)
  // ==========================================================================
  function setupEventListeners() {
    if (openAddActivityBtn) {
      openAddActivityBtn.addEventListener('click', openAddModal);
    }

    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', closeModal);
    }

    if (cancelModalBtn) {
      cancelModalBtn.addEventListener('click', closeModal);
    }

    // Close on backdrop click
    if (activityModal) {
      activityModal.addEventListener('click', (e) => {
        if (e.target === activityModal) {
          closeModal();
        }
      });
    }

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activityModal && activityModal.classList.contains('is-open')) {
        closeModal();
      }
    });

    // Form Submit
    if (activityForm) {
      activityForm.addEventListener('submit', handleFormSubmit);
    }
  }

  /**
   * Open Modal in Add Mode
   */
  function openAddModal() {
    if (!activityModal || !activityForm) return;

    clearModalAlerts();
    activityForm.reset();
    editingActivityIdInput.value = '';
    modalTitle.textContent = 'Add Activity to Itinerary';
    if (saveActivitySubmitBtn) {
      saveActivitySubmitBtn.innerHTML = '<span>💾</span> Save Activity';
    }

    // Default date to trip start date or today
    if (currentTrip && currentTrip.startDate && activityDateInput) {
      activityDateInput.value = currentTrip.startDate;
    } else if (activityDateInput) {
      activityDateInput.value = new Date().toISOString().split('T')[0];
    }

    // Default location to trip destination if available
    if (currentTrip && currentTrip.destination && activityLocationInput && !activityLocationInput.value) {
      activityLocationInput.value = currentTrip.destination;
    }

    activityModal.classList.add('is-open');
    activityModal.setAttribute('aria-hidden', 'false');
    if (activityNameInput) activityNameInput.focus();
  }

  /**
   * Open Modal in Edit Mode
   */
  function openEditModal(activityId) {
    if (!activityModal || !activityForm || !currentTrip) return;

    const activity = (currentTrip.itinerary || []).find(i => String(i.id) === String(activityId));
    if (!activity) return;

    clearModalAlerts();
    editingActivityIdInput.value = activity.id;
    modalTitle.textContent = 'Edit Itinerary Activity';
    if (saveActivitySubmitBtn) {
      saveActivitySubmitBtn.innerHTML = '<span>💾</span> Update Activity';
    }

    activityDateInput.value = activity.date || '';
    activityTimeInput.value = activity.time || '';
    activityNameInput.value = activity.activity || '';
    activityLocationInput.value = activity.location || '';
    activityNotesInput.value = activity.notes || '';

    activityModal.classList.add('is-open');
    activityModal.setAttribute('aria-hidden', 'false');
    if (activityNameInput) activityNameInput.focus();
  }

  /**
   * Close Modal
   */
  function closeModal() {
    if (!activityModal) return;
    activityModal.classList.remove('is-open');
    activityModal.setAttribute('aria-hidden', 'true');
    clearModalAlerts();
  }

  /**
   * Handle Form Submit (Add or Edit)
   */
  function handleFormSubmit(e) {
    e.preventDefault();
    clearModalAlerts();

    const date = activityDateInput ? activityDateInput.value.trim() : '';
    const time = activityTimeInput ? activityTimeInput.value.trim() : '';
    const name = activityNameInput ? activityNameInput.value.trim() : '';
    const location = activityLocationInput ? activityLocationInput.value.trim() : '';
    const notes = activityNotesInput ? activityNotesInput.value.trim() : '';
    const editingId = editingActivityIdInput ? editingActivityIdInput.value.trim() : '';

    // Validation
    if (!name) {
      showModalAlert('Activity name is required.', 'danger');
      if (activityNameInput) activityNameInput.focus();
      return;
    }

    if (!location) {
      showModalAlert('Activity location is required.', 'danger');
      if (activityLocationInput) activityLocationInput.focus();
      return;
    }

    if (!date) {
      showModalAlert('Activity date is required.', 'danger');
      if (activityDateInput) activityDateInput.focus();
      return;
    }

    // Validate date belongs to trip range where possible
    if (currentTrip && currentTrip.startDate && currentTrip.endDate) {
      if (date < currentTrip.startDate || date > currentTrip.endDate) {
        showModalAlert(`Note: Selected date (${formatDate(date)}) is outside your scheduled trip range (${formatDate(currentTrip.startDate)} – ${formatDate(currentTrip.endDate)}).`, 'warning');
      }
    }

    const activityData = {
      date: date,
      time: time,
      activity: name,
      location: location,
      notes: notes
    };

    if (editingId) {
      // Update existing item
      Storage.updateItineraryItem(currentTrip.id, editingId, activityData);
      showPageAlert(`Activity "${name}" updated successfully!`, 'success');
    } else {
      // Add new item
      Storage.addItineraryItem(currentTrip.id, activityData);
      showPageAlert(`Activity "${name}" added to itinerary!`, 'success');
    }

    closeModal();
    renderItinerary();
  }

  /**
   * Delete Activity with Confirmation
   */
  function handleDeleteActivity(activityId) {
    if (!currentTrip) return;

    const activity = (currentTrip.itinerary || []).find(i => String(i.id) === String(activityId));
    const activityName = activity ? `"${activity.activity}"` : 'this activity';

    if (window.confirm(`Are you sure you want to delete ${activityName} from your itinerary?`)) {
      Storage.deleteItineraryItem(currentTrip.id, activityId);
      showPageAlert('Activity deleted successfully.', 'warning');
      renderItinerary();
    }
  }

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  function groupActivitiesByDate(activities) {
    const groups = {};
    activities.forEach(item => {
      const key = item.date || 'unspecified';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  function formatDateLong(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    try {
      const [h, m] = timeStr.split(':');
      let hour = parseInt(h, 10);
      const minute = m || '00';
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      hour = hour ? hour : 12;
      return `${hour}:${minute} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  }

  function showModalAlert(message, type = 'danger') {
    if (!modalAlertContainer) return;
    modalAlertContainer.innerHTML = `
      <div class="alert alert-${type}">
        <span>⚠️</span>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
  }

  function clearModalAlerts() {
    if (modalAlertContainer) modalAlertContainer.innerHTML = '';
  }

  function showPageAlert(message, type = 'success') {
    if (!pageAlertContainer) return;
    pageAlertContainer.innerHTML = `
      <div class="alert alert-${type}" style="margin-bottom: 1.5rem;">
        <span>✓</span>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
    setTimeout(() => {
      if (pageAlertContainer) pageAlertContainer.innerHTML = '';
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match]));
  }
});
