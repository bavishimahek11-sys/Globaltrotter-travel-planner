/**
 * GlobalTrotter - Dedicated Shared Trip View JS (Phase 7 Clean Architecture)
 * Renders complete read-only trip information, itinerary, budget, map, and collaborators using API client.
 *
 * NOTE: Strictly no fake users, fake trips, fake collaborators, or localStorage database logic.
 */

document.addEventListener('DOMContentLoaded', () => {
  const sharedHeroTitle = document.getElementById('sharedHeroTitle');
  const sharedHeroSubtitle = document.getElementById('sharedHeroSubtitle');
  const sharedTripSummaryCard = document.getElementById('sharedTripSummaryCard');
  const sharedItineraryContainer = document.getElementById('sharedItineraryContainer');
  const sharedBudgetSummaryBox = document.getElementById('sharedBudgetSummaryBox');
  const sharedCategoryBreakdownCard = document.getElementById('sharedCategoryBreakdownCard');
  const sharedCategoriesList = document.getElementById('sharedCategoriesList');
  const sharedCollaboratorsContainer = document.getElementById('sharedCollaboratorsContainer');

  // Map elements
  const sharedTripMapEl = document.getElementById('sharedTripMap');
  const sharedMapEmptyState = document.getElementById('sharedMapEmptyState');
  const sharedMapBadge = document.getElementById('sharedMapBadge');
  let leafletMap = null;
  let layerGroup = null;

  // Retrieve Trip ID
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get('id');
  let currentTrip = null;

  loadSharedTrip();

  async function loadSharedTrip() {
    if (!tripId) {
      renderNotFound();
      return;
    }

    showLoading();

    try {
      currentTrip = await API.getTripById(tripId);
      if (!currentTrip) {
        renderNotFound();
        return;
      }
      renderSharedTrip();
    } catch (err) {
      console.warn('Shared trip loading error:', err.message);
      renderErrorState();
    }
  }

  function showLoading() {
    if (sharedTripSummaryCard) {
      sharedTripSummaryCard.innerHTML = `
        <div class="state-box" style="padding: 3rem 1.5rem;">
          <div class="spinner"></div>
          <div class="state-title">Loading Shared Trip...</div>
          <div class="state-desc">Fetching real-time trip information from backend server.</div>
        </div>
      `;
    }
  }

  function renderNotFound() {
    if (sharedTripSummaryCard) {
      sharedTripSummaryCard.innerHTML = `
        <div class="state-box" style="padding: 2.5rem 1.5rem;">
          <span class="state-icon">🔍</span>
          <div class="state-title">Shared trip not found or link has expired.</div>
          <div class="state-desc">The trip link you opened does not contain valid trip data. Plan a new trip or return home.</div>
          <div style="margin-top: 1.25rem;">
            <a href="create-trip.html" class="btn btn-primary btn-sm">Create a Trip</a>
          </div>
        </div>
      `;
    }
    if (sharedMapEmptyState) sharedMapEmptyState.style.display = 'block';
  }

  function renderErrorState() {
    if (sharedTripSummaryCard) {
      sharedTripSummaryCard.innerHTML = `
        <div class="state-box" style="padding: 3rem 1.5rem;">
          <span class="state-icon">⚠️</span>
          <div class="state-title">Unable to Load Shared Trip</div>
          <div class="state-desc">Could not connect to the backend server. Please check your connection.</div>
          <div style="margin-top: 1.25rem;">
            <button type="button" id="retrySharedTripBtn" class="btn btn-primary btn-sm">
              <span>🔄</span> Retry
            </button>
          </div>
        </div>
      `;

      const retryBtn = document.getElementById('retrySharedTripBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', loadSharedTrip);
      }
    }
  }

  function renderSharedTrip() {
    if (!currentTrip) return;

    const title = currentTrip.title || `Trip to ${currentTrip.toCity || 'Destination'}`;
    const destination = currentTrip.destination || (currentTrip.fromCity && currentTrip.toCity ? `${currentTrip.fromCity} ➔ ${currentTrip.toCity}` : 'Custom Destination');
    const dateRange = (currentTrip.startDate && currentTrip.endDate) 
      ? `${formatDate(currentTrip.startDate)} – ${formatDate(currentTrip.endDate)}` 
      : (currentTrip.startDate ? formatDate(currentTrip.startDate) : 'Dates flexible');
    const duration = currentTrip.duration || 'Flexible duration';
    const budget = currentTrip.budget ? `₹${Number(currentTrip.budget).toLocaleString()}` : 'Not specified';
    const stopsCount = currentTrip.addedStops ? currentTrip.addedStops.length : 0;

    if (sharedHeroTitle) sharedHeroTitle.textContent = title;
    if (sharedHeroSubtitle) sharedHeroSubtitle.textContent = `Shared travel itinerary: ${destination}`;

    // 1. Render Summary Card
    if (sharedTripSummaryCard) {
      sharedTripSummaryCard.innerHTML = `
        <div class="trip-details-top">
          <div class="trip-details-title-box">
            <h1>${escapeHtml(title)}</h1>
            <div class="trip-destination-pill">
              <span>📍</span> ${escapeHtml(destination)}
            </div>
          </div>
          <div>
            <span class="badge-role viewer" style="font-size: 0.85rem; padding: 0.35rem 0.75rem;">
              👁️ Shared Access (Viewer)
            </span>
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
            <span class="stat-label">Total Trip Budget</span>
            <span class="stat-value">💰 ${budget}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Smart Stops</span>
            <span class="stat-value">✨ ${stopsCount} intermediate ${stopsCount === 1 ? 'stop' : 'stops'}</span>
          </div>
        </div>
      `;
    }

    // 2. Render Map
    initSharedMap();

    // 3. Render Itinerary
    renderSharedItinerary();

    // 4. Render Budget
    renderSharedBudget();

    // 5. Render Collaborators
    renderSharedCollaborators();
  }

  function initSharedMap() {
    if (!sharedTripMapEl || typeof L === 'undefined') return;

    try {
      if (!leafletMap) {
        leafletMap = L.map('sharedTripMap', {
          zoomControl: true,
          scrollWheelZoom: false
        }).setView([20.5937, 78.9629], 5);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMap);

        layerGroup = L.featureGroup().addTo(leafletMap);
      } else {
        layerGroup.clearLayers();
      }

      const activities = currentTrip.itinerary || [];
      const validPoints = [];

      activities.forEach((item, index) => {
        const lat = parseFloat(item.latitude || item.lat);
        const lng = parseFloat(item.longitude || item.lng);

        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          const p = { lat, lng, title: item.activity || 'Place', location: item.location || '', time: item.time || '', notes: item.notes || '' };
          validPoints.push(p);

          const marker = L.marker([lat, lng]).addTo(layerGroup);
          marker.bindPopup(`
            <div class="map-popup-card">
              <div class="map-popup-title">#${index + 1} ${escapeHtml(p.title)}</div>
              <div class="map-popup-meta">📍 ${escapeHtml(p.location)} ${p.time ? `• ⏰ ${p.time}` : ''}</div>
              ${p.notes ? `<div class="map-popup-notes">${escapeHtml(p.notes)}</div>` : ''}
            </div>
          `);
        }
      });

      if (validPoints.length >= 2) {
        const latLngs = validPoints.map(p => [p.lat, p.lng]);
        L.polyline(latLngs, { color: '#2563eb', weight: 4, opacity: 0.85, dashArray: '6, 8' }).addTo(layerGroup);
      }

      if (validPoints.length > 0) {
        if (sharedMapEmptyState) sharedMapEmptyState.style.display = 'none';
        if (sharedMapBadge) sharedMapBadge.textContent = `${validPoints.length} location${validPoints.length === 1 ? '' : 's'} plotted`;
        try {
          leafletMap.fitBounds(layerGroup.getBounds(), { padding: [40, 40], maxZoom: 14 });
        } catch (e) {
          leafletMap.setView([validPoints[0].lat, validPoints[0].lng], 11);
        }
      } else {
        if (sharedMapEmptyState) sharedMapEmptyState.style.display = 'block';
        if (sharedMapBadge) sharedMapBadge.textContent = '0 locations plotted';
      }

      setTimeout(() => {
        if (leafletMap) leafletMap.invalidateSize();
      }, 200);
    } catch (e) {
      console.warn('Map initialization error in shared trip view:', e);
    }
  }

  function renderSharedItinerary() {
    if (!sharedItineraryContainer) return;
    const activities = currentTrip.itinerary || [];

    if (activities.length === 0) {
      sharedItineraryContainer.innerHTML = `
        <div class="state-box">
          <span class="state-icon">📋</span>
          <div class="state-title">No activities planned yet.</div>
          <div class="state-desc">The trip owner has not added any activities to this itinerary yet.</div>
        </div>
      `;
      return;
    }

    const grouped = groupActivitiesByDate(activities);
    const sortedDates = Object.keys(grouped).sort();

    let html = '';
    sortedDates.forEach((dateKey, index) => {
      const dayNumber = index + 1;
      const formattedDate = dateKey === 'unspecified' ? 'Flexible Date' : formatDateLong(dateKey);
      const dayActivities = grouped[dateKey];

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
        html += `
          <div class="activity-card" style="cursor: default;">
            <div class="activity-main">
              <div class="activity-time">
                <span>⏰</span> ${escapeHtml(item.time ? formatTime(item.time) : 'Flexible Time')}
              </div>
              <h4 class="activity-name">${escapeHtml(item.activity)}</h4>
              <div class="activity-location">
                <span>📍</span> ${escapeHtml(item.location)}
              </div>
              ${item.notes ? `<div class="activity-notes">${escapeHtml(item.notes)}</div>` : ''}
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    sharedItineraryContainer.innerHTML = html;
  }

  function renderSharedBudget() {
    if (!sharedBudgetSummaryBox) return;

    const totalBudget = Number(currentTrip.budget) || 0;
    const expenses = currentTrip.expenses || [];
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const remainingBudget = totalBudget > 0 ? (totalBudget - totalExpenses) : 0;
    const percentageUsed = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;
    const isExceeded = totalBudget > 0 && totalExpenses > totalBudget;
    const exceededAmount = isExceeded ? (totalExpenses - totalBudget) : 0;

    let progressClass = '';
    if (isExceeded || percentageUsed >= 100) progressClass = 'danger';
    else if (percentageUsed >= 80) progressClass = 'warning';

    sharedBudgetSummaryBox.innerHTML = `
      <div class="budget-grid-metrics">
        <div class="budget-metric-box metric-primary">
          <div class="budget-metric-title">Total Budget</div>
          <div class="budget-metric-value">${totalBudget > 0 ? `₹${totalBudget.toLocaleString()}` : 'Not set'}</div>
        </div>
        <div class="budget-metric-box metric-spent">
          <div class="budget-metric-title">Total Expenses</div>
          <div class="budget-metric-value">₹${totalExpenses.toLocaleString()}</div>
        </div>
        <div class="budget-metric-box ${isExceeded ? 'metric-exceeded' : 'metric-remaining'}">
          <div class="budget-metric-title">${isExceeded ? 'Budget Exceeded' : 'Remaining'}</div>
          <div class="budget-metric-value" style="${isExceeded ? 'color: var(--danger);' : ''}">
            ${isExceeded ? `⚠️ ₹${exceededAmount.toLocaleString()}` : (totalBudget > 0 ? `₹${remainingBudget.toLocaleString()}` : 'N/A')}
          </div>
        </div>
        <div class="budget-metric-box ${isExceeded ? 'metric-exceeded' : ''}">
          <div class="budget-metric-title">Budget Used</div>
          <div class="budget-metric-value" style="${isExceeded ? 'color: var(--danger);' : ''}">
            ${totalBudget > 0 ? `${percentageUsed}%` : 'N/A'}
          </div>
        </div>
      </div>

      ${totalBudget > 0 ? `
        <div class="budget-progress-section">
          <div class="progress-header">
            <span>Budget Utilization</span>
            <span>${percentageUsed}% Used</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill ${progressClass}" style="width: ${Math.min(percentageUsed, 100)}%;"></div>
          </div>
        </div>
      ` : ''}
    `;

    // Category breakdown
    if (expenses.length > 0 && sharedCategoryBreakdownCard && sharedCategoriesList) {
      sharedCategoryBreakdownCard.style.display = 'block';
      const categoriesMap = {
        'Transport': { label: '🚗 Transport', sum: 0, class: 'transport' },
        'Accommodation': { label: '🏨 Accommodation', sum: 0, class: 'accommodation' },
        'Food': { label: '🍽️ Food & Dining', sum: 0, class: 'food' },
        'Activities': { label: '🎟️ Activities & Sights', sum: 0, class: 'activities' },
        'Shopping': { label: '🛍️ Shopping', sum: 0, class: 'shopping' },
        'Other': { label: '📦 Other', sum: 0, class: 'other' }
      };

      expenses.forEach(e => {
        const cat = e.category || 'Other';
        if (!categoriesMap[cat]) categoriesMap[cat] = { label: `📦 ${cat}`, sum: 0, class: 'other' };
        categoriesMap[cat].sum += (Number(e.amount) || 0);
      });

      let catHtml = '';
      Object.keys(categoriesMap).forEach(key => {
        const d = categoriesMap[key];
        if (d.sum > 0) {
          const pct = totalExpenses > 0 ? Math.round((d.sum / totalExpenses) * 100) : 0;
          catHtml += `
            <div class="category-item">
              <div class="category-item-header">
                <span>${d.label}</span>
                <span>₹${d.sum.toLocaleString()} (${pct}%)</span>
              </div>
              <div class="category-track">
                <div class="category-fill ${d.class}" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        }
      });
      sharedCategoriesList.innerHTML = catHtml;
    } else if (sharedCategoryBreakdownCard) {
      sharedCategoryBreakdownCard.style.display = 'none';
    }
  }

  function renderSharedCollaborators() {
    if (!sharedCollaboratorsContainer) return;
    const collabs = currentTrip.collaborators || [];

    if (collabs.length === 0) {
      sharedCollaboratorsContainer.innerHTML = `
        <div class="state-box" style="padding: 2rem 1.5rem;">
          <span class="state-icon">👥</span>
          <div class="state-title">No other collaborators listed.</div>
        </div>
      `;
      return;
    }

    let html = '<div class="collaborators-grid">';
    collabs.forEach(c => {
      const displayName = c.name || c.email.split('@')[0];
      const initials = getInitials(displayName);
      const roleClass = (c.role || 'Viewer').toLowerCase();

      html += `
        <div class="collaborator-card">
          <div class="collaborator-profile">
            <div class="collaborator-avatar">${escapeHtml(initials)}</div>
            <div class="collaborator-info">
              <span class="collaborator-name">${escapeHtml(displayName)}</span>
              <span class="collaborator-email">${escapeHtml(c.email)}</span>
              <span class="badge-role ${escapeHtml(roleClass)}">${escapeHtml(c.role || 'Viewer')}</span>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';

    sharedCollaboratorsContainer.innerHTML = html;
  }

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

  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
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
