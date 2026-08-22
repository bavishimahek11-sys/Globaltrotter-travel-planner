/**
 * GlobalTrotter - Itinerary Page JS
 * Displays the current trip route and intermediate stops from session storage.
 * Strictly no fake users.
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('itineraryContent');
  if (!container) return;

  const trip = Storage.getActiveTrip();

  if (!trip.fromCity && !trip.toCity && (!trip.addedStops || trip.addedStops.length === 0)) {
    container.innerHTML = `
      <div class="state-box">
        <span class="state-icon">🗺️</span>
        <div class="state-title">No Active Itinerary</div>
        <div class="state-desc">You haven't planned a trip route yet. Head over to the trip planner to choose your route and get smart stop suggestions.</div>
        <div style="margin-top: 1.5rem;">
          <a href="create-trip.html" class="btn btn-primary">Plan a Trip Now</a>
        </div>
      </div>
    `;
    return;
  }

  let html = `
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-surface-alt); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
      <div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">Current Route</div>
        <div style="font-size: 1.15rem; font-weight: 700; color: var(--primary);">${escapeHtml(trip.fromCity || 'Origin')} ➔ ${escapeHtml(trip.toCity || 'Destination')}</div>
      </div>
      <div class="stop-tag" style="margin-bottom: 0;">${trip.addedStops ? trip.addedStops.length : 0} Smart Stops Added</div>
    </div>

    <ul class="timeline-list">
  `;

  if (trip.fromCity) {
    html += `
      <li class="timeline-item">
        <div class="timeline-dot origin"></div>
        <div class="timeline-content">
          <div>
            <div class="timeline-name">🛫 ${escapeHtml(trip.fromCity)}</div>
            <div class="timeline-type">Departure Point</div>
          </div>
        </div>
      </li>
    `;
  }

  if (trip.addedStops && trip.addedStops.length > 0) {
    trip.addedStops.forEach(stop => {
      html += `
        <li class="timeline-item">
          <div class="timeline-dot stop"></div>
          <div class="timeline-content">
            <div>
              <div class="timeline-name">📍 ${escapeHtml(stop.city)}</div>
              <div class="timeline-type">${escapeHtml(stop.category || 'Intermediate Stop')} • Recommended Stop: ${escapeHtml(stop.duration || 'Flexible')}</div>
              ${stop.description ? `<p style="font-size: 0.825rem; color: var(--text-muted); margin-top: 0.25rem;">${escapeHtml(stop.description)}</p>` : ''}
            </div>
            <button type="button" class="btn-remove-stop" title="Remove stop" data-city="${escapeHtml(stop.city)}">✕</button>
          </div>
        </li>
      `;
    });
  }

  if (trip.toCity) {
    html += `
      <li class="timeline-item">
        <div class="timeline-dot destination"></div>
        <div class="timeline-content">
          <div>
            <div class="timeline-name">🛬 ${escapeHtml(trip.toCity)}</div>
            <div class="timeline-type">Final Destination</div>
          </div>
        </div>
      </li>
    `;
  }

  html += `</ul>`;

  container.innerHTML = html;

  // Bind remove buttons
  container.querySelectorAll('.btn-remove-stop').forEach(btn => {
    btn.addEventListener('click', () => {
      const city = btn.getAttribute('data-city');
      if (city) {
        Storage.removeStop(city);
        location.reload();
      }
    });
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match]));
  }
});
