/**
 * GlobalTrotter - My Trips Dashboard JS (Phase 7 Final Clean Architecture)
 * Fetches and displays trips from backend API with clean loading, empty, and error states.
 *
 * NOTE: Strictly no fake trips and no localStorage database logic.
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('tripsContainer');
  if (!container) return;

  loadTrips();

  async function loadTrips() {
    showLoading();

    try {
      const trips = await API.getTrips();
      renderTrips(trips);
    } catch (err) {
      console.warn('Trips load notice:', err.message);
      showError();
    }
  }

  function showLoading() {
    container.innerHTML = `
      <div class="card" style="max-width: 700px; margin: 0 auto; text-align: center; padding: 3.5rem 2rem;">
        <div class="spinner"></div>
        <div class="state-title">Loading Trips...</div>
        <div class="state-desc">Fetching your saved travel plans from the database.</div>
      </div>
    `;
  }

  function showError() {
    container.innerHTML = `
      <div class="card" style="max-width: 700px; margin: 0 auto; text-align: center; padding: 3.5rem 2rem;">
        <span class="state-icon">⚠️</span>
        <h2 style="font-size: 1.35rem; margin-bottom: 0.5rem;">Unable to Load Trips</h2>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Could not connect to the backend server. Please verify your connection and try again.</p>
        <button type="button" id="retryTripsBtn" class="btn btn-primary">
          <span>🔄</span> Retry
        </button>
      </div>
    `;

    const retryBtn = document.getElementById('retryTripsBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', loadTrips);
    }
  }

  function renderTrips(trips) {
    if (!trips || !Array.isArray(trips) || trips.length === 0) {
      container.innerHTML = `
        <div class="card" style="max-width: 700px; margin: 0 auto; text-align: center; padding: 3.5rem 2rem;">
          <span class="state-icon">🎒</span>
          <h2 style="font-size: 1.35rem; margin-bottom: 0.5rem;">No trips yet. Create your first trip.</h2>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Plan your first journey with smart stop suggestions and build your personalized itinerary.</p>
          <a href="create-trip.html" class="btn btn-primary">
            <span>✨</span> Create a Trip
          </a>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'trips-grid';

    trips.forEach(trip => {
      const card = document.createElement('div');
      card.className = 'trip-card';

      const activityCount = trip.itinerary && Array.isArray(trip.itinerary) ? trip.itinerary.length : 0;
      const stopsCount = trip.addedStops && Array.isArray(trip.addedStops) ? trip.addedStops.length : 0;
      const dateRange = (trip.startDate && trip.endDate) 
        ? `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}` 
        : (trip.startDate ? formatDate(trip.startDate) : 'Dates flexible');

      card.innerHTML = `
        <div>
          <div class="trip-card-header">
            <h3 class="trip-card-title">${escapeHtml(trip.title || 'Untitled Trip')}</h3>
            <div class="trip-card-destination">
              <span>📍</span> ${escapeHtml(trip.destination || `${trip.fromCity || 'Origin'} ➔ ${trip.toCity || 'Destination'}`)}
            </div>
          </div>

          <div class="trip-card-details">
            <div><strong>🗓️ Dates:</strong> ${dateRange}</div>
            <div><strong>⏱️ Duration:</strong> ${escapeHtml(trip.duration || 'Flexible')}</div>
            <div><strong>💰 Budget:</strong> ${trip.budget ? `₹${Number(trip.budget).toLocaleString()}` : 'Not set'}</div>
            <div><strong>📋 Itinerary:</strong> ${activityCount} ${activityCount === 1 ? 'activity' : 'activities'}${stopsCount > 0 ? ` • ${stopsCount} smart stops` : ''}</div>
          </div>
        </div>

        <div class="trip-card-footer">
          <button type="button" class="btn-icon btn-icon-danger btn-delete-trip" data-id="${escapeHtml(trip.id)}" title="Delete trip">
            <span>🗑️</span> Delete
          </button>
          <a href="itinerary.html?id=${encodeURIComponent(trip.id)}" class="btn btn-sm btn-primary">
            <span>📋</span> View Itinerary
          </a>
        </div>
      `;

      // Handle Delete Trip
      const deleteBtn = card.querySelector('.btn-delete-trip');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${trip.title || 'this trip'}"?`)) {
          try {
            await API.deleteTrip(trip.id);
            loadTrips();
          } catch (err) {
            alert('Failed to delete trip. Please try again.');
          }
        }
      });

      grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
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
