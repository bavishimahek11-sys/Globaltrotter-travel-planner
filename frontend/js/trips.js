/**
 * GlobalTrotter - My Trips Dashboard JS
 * Loads and displays user-created trips from storage.
 * Strictly no fake users or hardcoded fake trips.
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('tripsContainer');
  if (!container) return;

  renderTrips();

  function renderTrips() {
    const trips = Storage.getTrips();

    if (!trips || trips.length === 0) {
      container.innerHTML = `
        <div class="card" style="max-width: 700px; margin: 0 auto; text-align: center; padding: 3.5rem 2rem;">
          <span class="state-icon">🎒</span>
          <h2 style="font-size: 1.35rem; margin-bottom: 0.5rem;">No Saved Trips Yet</h2>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Plan your first trip with smart stop suggestions and build your personalized itinerary.</p>
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

      const activityCount = trip.itinerary ? trip.itinerary.length : 0;
      const stopsCount = trip.addedStops ? trip.addedStops.length : 0;
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
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${trip.title || 'this trip'}"?`)) {
          Storage.deleteTrip(trip.id);
          renderTrips();
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
