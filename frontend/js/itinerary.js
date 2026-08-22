/**
 * GlobalTrotter - Trip Details, Itinerary, Budget, Map & Collaboration JS (Phase 7 Clean Architecture)
 * Fully data-driven from backend API endpoints with clean loading, empty, and error states.
 *
 * NOTE: Strictly no fake users, fake trips, fake expenses, or localStorage database logic.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tripSummaryCard = document.getElementById('tripSummaryCard');
  const itineraryDaysContainer = document.getElementById('itineraryDaysContainer');
  const budgetSummaryBox = document.getElementById('budgetSummaryBox');
  const categoryBreakdownCard = document.getElementById('categoryBreakdownCard');
  const categoriesList = document.getElementById('categoriesList');
  const expensesContainer = document.getElementById('expensesContainer');
  const collaboratorsListContainer = document.getElementById('collaboratorsListContainer');
  const pageHeroTitle = document.getElementById('pageHeroTitle');
  const pageAlertContainer = document.getElementById('pageAlertContainer');
  const readOnlyBanner = document.getElementById('readOnlyBanner');

  // Map Elements
  const tripMapEl = document.getElementById('tripMap');
  const mapEmptyState = document.getElementById('mapEmptyState');
  const mapPointsBadge = document.getElementById('mapPointsBadge');
  let leafletMap = null;
  let markersLayer = null;
  let activityMarkersMap = {};
  
  // Activity Modal Elements
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
  const activityLatInput = document.getElementById('activityLat');
  const activityLngInput = document.getElementById('activityLng');
  const activityNotesInput = document.getElementById('activityNotes');
  const saveActivitySubmitBtn = document.getElementById('saveActivitySubmitBtn');

  // Expense Modal Elements
  const expenseModal = document.getElementById('expenseModal');
  const openAddExpenseBtn = document.getElementById('openAddExpenseBtn');
  const closeExpenseModalBtn = document.getElementById('closeExpenseModalBtn');
  const cancelExpenseModalBtn = document.getElementById('cancelExpenseModalBtn');
  const expenseForm = document.getElementById('expenseForm');
  const expenseModalTitle = document.getElementById('expenseModalTitle');
  const expenseModalAlertContainer = document.getElementById('expenseModalAlertContainer');
  const editingExpenseIdInput = document.getElementById('editingExpenseId');
  const expenseTitleInput = document.getElementById('expenseTitle');
  const expenseCategoryInput = document.getElementById('expenseCategory');
  const expenseAmountInput = document.getElementById('expenseAmount');
  const expenseDateInput = document.getElementById('expenseDate');
  const expenseNotesInput = document.getElementById('expenseNotes');
  const saveExpenseSubmitBtn = document.getElementById('saveExpenseSubmitBtn');

  // Share Modal Elements
  const shareModal = document.getElementById('shareModal');
  const closeShareModalBtn = document.getElementById('closeShareModalBtn');
  const cancelShareModalBtn = document.getElementById('cancelShareModalBtn');
  const shareModalTripInfo = document.getElementById('shareModalTripInfo');
  const shareLinkInput = document.getElementById('shareLinkInput');
  const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');
  const shareCopyFeedback = document.getElementById('shareCopyFeedback');

  // Invite Collaborator Modal Elements
  const inviteModal = document.getElementById('inviteModal');
  const openInviteModalBtn = document.getElementById('openInviteModalBtn');
  const closeInviteModalBtn = document.getElementById('closeInviteModalBtn');
  const cancelInviteModalBtn = document.getElementById('cancelInviteModalBtn');
  const inviteCollaboratorForm = document.getElementById('inviteCollaboratorForm');
  const inviteModalAlertContainer = document.getElementById('inviteModalAlertContainer');
  const inviteEmailInput = document.getElementById('inviteEmail');
  const inviteNameInput = document.getElementById('inviteName');
  const inviteRoleInput = document.getElementById('inviteRole');
  const sendInviteSubmitBtn = document.getElementById('sendInviteSubmitBtn');

  // Target Trip & State
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get('id');
  const requestedRole = urlParams.get('role'); // e.g. 'viewer'
  let currentTrip = null;
  let isViewerMode = requestedRole === 'viewer';

  // Initialize
  initTripMap();
  setupEventListeners();
  loadTripData();

  // ==========================================================================
  // 1. DATA LOADING & STATE MANAGEMENT
  // ==========================================================================
  async function loadTripData() {
    if (!tripId) {
      await renderTripSelector();
      return;
    }

    showGlobalLoading();

    try {
      currentTrip = await API.getTripById(tripId);
      if (!currentTrip) {
        await renderTripSelector();
        return;
      }

      isViewerMode = requestedRole === 'viewer' || (currentTrip.currentUserRole === 'Viewer');

      renderTripDetails();
      renderItinerary();
      renderCollaborators();
      applyRolePermissions();
    } catch (err) {
      console.warn('Trip loading notice:', err.message);
      renderErrorState();
    }
  }

  function showGlobalLoading() {
    if (tripSummaryCard) {
      tripSummaryCard.innerHTML = `
        <div class="state-box" style="padding: 3rem 2rem;">
          <div class="spinner"></div>
          <div class="state-title">Loading Trip Details...</div>
          <div class="state-desc">Fetching real-time trip information, activities, budget, and route.</div>
        </div>
      `;
    }
  }

  function renderErrorState() {
    if (tripSummaryCard) {
      tripSummaryCard.innerHTML = `
        <div class="state-box" style="padding: 3rem 2rem;">
          <span class="state-icon">⚠️</span>
          <div class="state-title">Unable to Load Trip Details</div>
          <div class="state-desc">Could not connect to the backend server. Please verify your connection and try again.</div>
          <div style="margin-top: 1.25rem;">
            <button type="button" id="retryTripBtn" class="btn btn-primary btn-sm">
              <span>🔄</span> Retry
            </button>
          </div>
        </div>
      `;

      const retryBtn = document.getElementById('retryTripBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', loadTripData);
      }
    }
  }

  async function renderTripSelector() {
    if (openAddActivityBtn) openAddActivityBtn.style.display = 'none';
    if (openInviteModalBtn) openInviteModalBtn.style.display = 'none';
    const collabSection = document.getElementById('collaboratorsSection');
    if (collabSection) collabSection.style.display = 'none';
    const itinSection = document.querySelector('.itinerary-section');
    if (itinSection) itinSection.style.display = 'none';

    if (!tripSummaryCard) return;

    tripSummaryCard.innerHTML = `
      <div class="state-box" style="padding: 3rem 2rem;">
        <div class="spinner"></div>
        <div class="state-title">Loading your trips...</div>
        <div class="state-desc">Fetching saved travel plans from the database.</div>
      </div>
    `;

    try {
      const trips = await API.getTrips();
      if (!trips || !Array.isArray(trips) || trips.length === 0) {
        tripSummaryCard.innerHTML = `
          <div class="state-box" style="padding: 2.5rem 1.5rem;">
            <span class="state-icon">🎒</span>
            <div class="state-title">No trips yet.</div>
            <div class="state-desc">Plan your first trip to build your personalized day-by-day itinerary.</div>
            <div style="margin-top: 1.25rem;">
              <a href="create-trip.html" class="btn btn-primary btn-sm"><span>✨</span> Plan a Trip</a>
            </div>
          </div>
        `;
        return;
      }

      let tripsGridHtml = '';
      trips.forEach(t => {
        const dest = t.destination || (t.fromCity && t.toCity ? `${t.fromCity} ➔ ${t.toCity}` : 'Destination');
        const destCity = t.toCity || t.destination || t.title || 'Destination';
        const destImg = typeof getDestinationImage === 'function' ? getDestinationImage(destCity) : 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80';
        const dates = (t.startDate && t.endDate) ? `${formatDate(t.startDate)} – ${formatDate(t.endDate)}` : (t.startDate ? formatDate(t.startDate) : 'Dates flexible');
        const actCount = t.itinerary && Array.isArray(t.itinerary) ? t.itinerary.length : 0;

        tripsGridHtml += `
          <div class="trip-card" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; background: var(--bg-surface); display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
            <div>
              <div class="trip-card-img-wrapper">
                <img src="${destImg}" alt="${escapeHtml(t.title || 'Trip')}" class="trip-card-banner" loading="lazy">
                <span class="trip-card-badge">📍 ${escapeHtml(t.toCity || destCity)}</span>
              </div>
              <h3 style="font-size: 1.15rem; margin-bottom: 0.35rem; color: var(--text-main);">${escapeHtml(t.title || t.name || 'Trip')}</h3>
              <div style="color: var(--primary); font-size: 0.9rem; font-weight: 600; margin-bottom: 0.75rem;">📍 ${escapeHtml(dest)}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.3rem;">
                <div>🗓️ <strong>Dates:</strong> ${dates}</div>
                <div>⏱️ <strong>Duration:</strong> ${escapeHtml(t.duration || 'Flexible')}</div>
                <div>📋 <strong>Activities:</strong> ${actCount} scheduled</div>
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
              <a href="itinerary.html?id=${encodeURIComponent(t.id)}" class="btn btn-sm btn-primary" style="width: 100%;">
                <span>📋</span> View Itinerary ➔
              </a>
            </div>
          </div>
        `;
      });

      tripSummaryCard.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h2 class="section-title" style="margin-bottom: 0.25rem;"><span>📋</span> Select a Trip to View Itinerary</h2>
          <p class="section-subtitle">Choose one of your saved journeys to manage activities, timing, and travel notes.</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
          ${tripsGridHtml}
        </div>
        <div style="text-align: center; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
          <a href="create-trip.html" class="btn btn-outline">
            <span>+</span> Plan a New Trip
          </a>
        </div>
      `;
    } catch (err) {
      tripSummaryCard.innerHTML = `
        <div class="state-box" style="padding: 2.5rem 1.5rem;">
          <span class="state-icon">⚠️</span>
          <div class="state-title">Unable to load your trips.</div>
          <div class="state-desc">Could not connect to the backend server. Please verify your connection.</div>
          <div style="margin-top: 1.25rem;">
            <button type="button" id="retryTripSelectorBtn" class="btn btn-primary btn-sm">
              <span>🔄</span> Try again
            </button>
          </div>
        </div>
      `;
      const retryBtn = document.getElementById('retryTripSelectorBtn');
      if (retryBtn) retryBtn.addEventListener('click', renderTripSelector);
    }
  }

  // ==========================================================================
  // 2. RENDER TRIP DETAILS SUMMARY
  // ==========================================================================
  function renderTripDetails() {
    if (!tripSummaryCard || !currentTrip) return;

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
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <a href="budget.html?id=${encodeURIComponent(currentTrip.id)}" class="btn btn-sm btn-outline" title="Open trip budget">
            <span>💰</span> View Budget
          </a>
          <a href="map.html?id=${encodeURIComponent(currentTrip.id)}" class="btn btn-sm btn-outline" title="Open trip map">
            <span>🗺️</span> View Map
          </a>
          <button type="button" id="openShareModalBtn" class="btn btn-sm btn-outline">
            <span>🔗</span> Share Trip
          </button>
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
          <span class="stat-label">Total Trip Budget</span>
          <span class="stat-value">💰 ${budget}</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Smart Stops</span>
          <span class="stat-value">✨ ${stopsCount} intermediate ${stopsCount === 1 ? 'stop' : 'stops'}</span>
        </div>
      </div>
    `;

    const shareBtn = document.getElementById('openShareModalBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', openShareModal);
    }
  }

  // ==========================================================================
  // 3. INTERACTIVE MAP & ROUTE VISUALIZATION (LEAFLET.JS)
  // ==========================================================================
  function initTripMap() {
    if (!tripMapEl || typeof L === 'undefined') return;

    try {
      if (!leafletMap) {
        leafletMap = L.map('tripMap', {
          zoomControl: true,
          scrollWheelZoom: false
        }).setView([20.5937, 78.9629], 5);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMap);

        markersLayer = L.featureGroup().addTo(leafletMap);
      }
    } catch (e) {
      console.warn('Map initialization note:', e);
    }
  }

  function renderTripMap() {
    if (!leafletMap) {
      initTripMap();
    }
    if (!leafletMap || !markersLayer || !currentTrip) return;

    markersLayer.clearLayers();
    activityMarkersMap = {};

    const validPoints = [];

    // 1. Collect waypoints from destinations (origin, intermediate stops, destination)
    const destinations = currentTrip.destinations || currentTrip.addedStops || [];
    destinations.forEach((dest, idx) => {
      const lat = parseFloat(dest.latitude || dest.lat);
      const lng = parseFloat(dest.longitude || dest.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const isFirst = idx === 0;
        const isLast = idx === destinations.length - 1;
        let role = isFirst ? 'Origin' : (isLast ? 'Destination' : 'Stop');
        const pointData = {
          lat,
          lng,
          id: `dest-${dest.id || idx}`,
          title: dest.city || dest.name || `${role} Location`,
          location: dest.country ? `${dest.city || dest.name}, ${dest.country}` : (dest.city || dest.name || ''),
          date: dest.visit_date || '',
          time: '',
          notes: dest.notes || '',
          role: role
        };
        validPoints.push(pointData);

        const marker = L.marker([lat, lng]).addTo(markersLayer);
        const popupContent = `
          <div class="map-popup-card">
            <div class="map-popup-title">${role === 'Origin' ? '🏁' : (role === 'Destination' ? '🎯' : '📍')} ${escapeHtml(pointData.title)}</div>
            <div class="map-popup-meta"><strong>${role}</strong> ${pointData.location ? `• ${escapeHtml(pointData.location)}` : ''}</div>
            ${pointData.notes ? `<div class="map-popup-notes">${escapeHtml(pointData.notes)}</div>` : ''}
          </div>
        `;
        marker.bindPopup(popupContent);
      }
    });

    // 2. If destinations didn't include start/destination coordinates, check trip-level coordinates
    if (validPoints.length === 0) {
      const startLat = parseFloat(currentTrip.start_latitude || currentTrip.startLatitude);
      const startLng = parseFloat(currentTrip.start_longitude || currentTrip.startLongitude);
      if (!isNaN(startLat) && !isNaN(startLng) && startLat >= -90 && startLat <= 90 && startLng >= -180 && startLng <= 180) {
        const startPoint = {
          lat: startLat,
          lng: startLng,
          id: 'start-city',
          title: currentTrip.fromCity || 'Starting Location',
          location: currentTrip.fromCity || '',
          role: 'Origin'
        };
        validPoints.push(startPoint);
        const startMarker = L.marker([startLat, startLng]).addTo(markersLayer);
        startMarker.bindPopup(`
          <div class="map-popup-card">
            <div class="map-popup-title">🏁 ${escapeHtml(startPoint.title)}</div>
            <div class="map-popup-meta"><strong>Origin City</strong></div>
          </div>
        `);
      }

      const destLat = parseFloat(currentTrip.destination_latitude || currentTrip.destinationLatitude);
      const destLng = parseFloat(currentTrip.destination_longitude || currentTrip.destinationLongitude);
      if (!isNaN(destLat) && !isNaN(destLng) && destLat >= -90 && destLat <= 90 && destLng >= -180 && destLng <= 180) {
        const destPoint = {
          lat: destLat,
          lng: destLng,
          id: 'dest-city',
          title: currentTrip.toCity || currentTrip.destination || 'Destination Location',
          location: currentTrip.toCity || currentTrip.destination || '',
          role: 'Destination'
        };
        validPoints.push(destPoint);
        const destMarker = L.marker([destLat, destLng]).addTo(markersLayer);
        destMarker.bindPopup(`
          <div class="map-popup-card">
            <div class="map-popup-title">🎯 ${escapeHtml(destPoint.title)}</div>
            <div class="map-popup-meta"><strong>Destination City</strong></div>
          </div>
        `);
      }
    }

    // 3. Collect waypoints from scheduled itinerary activities
    const activities = currentTrip.itinerary || [];
    activities.forEach((item, index) => {
      const lat = parseFloat(item.latitude || item.lat);
      const lng = parseFloat(item.longitude || item.lng);

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const isDuplicate = validPoints.some(p => Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lng - lng) < 0.0001 && p.title === item.activity);
        if (!isDuplicate) {
          const pointData = {
            lat,
            lng,
            id: item.id,
            title: item.activity || 'Activity Location',
            location: item.location || '',
            date: item.date || '',
            time: item.time || '',
            notes: item.notes || '',
            order: index + 1
          };
          validPoints.push(pointData);

          const marker = L.marker([lat, lng]).addTo(markersLayer);
          const popupContent = `
            <div class="map-popup-card">
              <div class="map-popup-title">#${index + 1} ${escapeHtml(pointData.title)}</div>
              <div class="map-popup-meta">📍 ${escapeHtml(pointData.location)} ${pointData.time ? `• ⏰ ${formatTime(pointData.time)}` : ''}</div>
              ${pointData.notes ? `<div class="map-popup-notes">${escapeHtml(pointData.notes)}</div>` : ''}
            </div>
          `;
          marker.bindPopup(popupContent);

          marker.on('click', () => {
            highlightItineraryCard(item.id);
          });

          activityMarkersMap[item.id] = marker;
        }
      }
    });

    if (validPoints.length >= 2) {
      const latLngs = validPoints.map(p => [p.lat, p.lng]);
      L.polyline(latLngs, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.85,
        dashArray: '6, 8'
      }).addTo(markersLayer);
    }

    if (validPoints.length > 0) {
      if (mapEmptyState) mapEmptyState.style.display = 'none';
      if (tripMapEl) tripMapEl.style.height = '420px';
      if (mapPointsBadge) mapPointsBadge.textContent = `${validPoints.length} location${validPoints.length === 1 ? '' : 's'} plotted`;
      
      try {
        leafletMap.fitBounds(markersLayer.getBounds(), { padding: [45, 45], maxZoom: 14 });
      } catch (e) {
        leafletMap.setView([validPoints[0].lat, validPoints[0].lng], 11);
      }
    } else {
      if (mapEmptyState) {
        mapEmptyState.style.display = 'block';
        mapEmptyState.innerHTML = `
          <span class="state-icon">📍</span>
          <div class="state-title">Location data is not available for this trip.</div>
          <div class="state-desc">Automatic geocoding could not determine coordinates for the entered locations, or no location coordinates were provided.</div>
        `;
      }
      if (mapPointsBadge) mapPointsBadge.textContent = '0 locations plotted';
    }

    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize();
    }, 200);
  }

  function focusMapOnActivity(activityId) {
    if (!activityMarkersMap[activityId] || !leafletMap) return;
    const marker = activityMarkersMap[activityId];
    const latLng = marker.getLatLng();
    leafletMap.setView(latLng, 14, { animate: true });
    marker.openPopup();
  }

  function highlightItineraryCard(activityId) {
    if (!itineraryDaysContainer) return;
    itineraryDaysContainer.querySelectorAll('.activity-card').forEach(card => {
      if (card.getAttribute('data-id') === String(activityId)) {
        card.classList.add('is-active-marker');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        card.classList.remove('is-active-marker');
      }
    });
  }

  // ==========================================================================
  // 4. RENDER ITINERARY ACTIVITIES
  // ==========================================================================
  function renderItinerary() {
    if (!itineraryDaysContainer || !currentTrip) return;

    const activities = currentTrip.itinerary || [];

    if (activities.length === 0) {
      itineraryDaysContainer.innerHTML = `
        <div class="state-box">
          <span class="state-icon">📋</span>
          <div class="state-title">No activities planned yet.</div>
          <div class="state-desc">Your itinerary is currently empty. Start building your schedule by adding sights, tours, meal stops, or hotel check-ins.</div>
          ${!isViewerMode ? `
            <button type="button" class="btn btn-primary btn-add-first-activity">
              <span>+</span> Add Activity
            </button>
          ` : ''}
        </div>
      `;

      const addFirstBtn = itineraryDaysContainer.querySelector('.btn-add-first-activity');
      if (addFirstBtn) {
        addFirstBtn.addEventListener('click', openAddModal);
      }
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
        const timeDisplay = item.time ? formatTime(item.time) : 'Flexible Time';
        const hasCoords = item.latitude && item.longitude;

        html += `
          <div class="activity-card" data-id="${escapeHtml(item.id)}">
            <div class="activity-main">
              <div class="activity-time">
                <span>⏰</span> ${escapeHtml(timeDisplay)}
              </div>
              <h4 class="activity-name">${escapeHtml(item.activity)}</h4>
              <div class="activity-location">
                <span>📍</span> ${escapeHtml(item.location)}
                ${hasCoords ? `<span style="color: var(--primary); font-size: 0.75rem; margin-left: 0.5rem; font-weight: 600;">(🗺️ On Map)</span>` : ''}
              </div>
              ${item.notes ? `<div class="activity-notes">${escapeHtml(item.notes)}</div>` : ''}
            </div>

            ${!isViewerMode ? `
              <div class="activity-actions">
                <button type="button" class="btn-icon btn-edit-activity" data-id="${escapeHtml(item.id)}" title="Edit activity">
                  <span>✏️</span> Edit
                </button>
                <button type="button" class="btn-icon btn-icon-danger btn-delete-activity" data-id="${escapeHtml(item.id)}" title="Delete activity">
                  <span>🗑️</span> Delete
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    itineraryDaysContainer.innerHTML = html;

    itineraryDaysContainer.querySelectorAll('.activity-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-icon')) return;
        const actId = card.getAttribute('data-id');
        highlightItineraryCard(actId);
        focusMapOnActivity(actId);
      });
    });

    if (!isViewerMode) {
      itineraryDaysContainer.querySelectorAll('.btn-edit-activity').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const actId = btn.getAttribute('data-id');
          openEditModal(actId);
        });
      });

      itineraryDaysContainer.querySelectorAll('.btn-delete-activity').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const actId = btn.getAttribute('data-id');
          handleDeleteActivity(actId);
        });
      });
    }
  }

  // ==========================================================================
  // 5. RENDER BUDGET TRACKING & EXPENSES
  // ==========================================================================
  function renderBudgetAndExpenses() {
    if (!budgetSummaryBox || !expensesContainer || !currentTrip) return;

    const totalBudget = Number(currentTrip.budget) || 0;
    const expenses = currentTrip.expenses || [];
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    const remainingBudget = totalBudget > 0 ? (totalBudget - totalExpenses) : 0;
    const percentageUsed = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;
    const isExceeded = totalBudget > 0 && totalExpenses > totalBudget;
    const exceededAmount = isExceeded ? (totalExpenses - totalBudget) : 0;

    let progressClass = '';
    if (isExceeded || percentageUsed >= 100) {
      progressClass = 'danger';
    } else if (percentageUsed >= 80) {
      progressClass = 'warning';
    }

    const progressFillWidth = Math.min(percentageUsed, 100);

    budgetSummaryBox.innerHTML = `
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
          <div class="budget-metric-title">${isExceeded ? 'Budget Exceeded By' : 'Remaining Budget'}</div>
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

      ${isExceeded ? `
        <div class="alert alert-danger" style="margin-bottom: 1.25rem;">
          <span>⚠️</span>
          <div><strong>Budget exceeded!</strong> Your total expenses have exceeded your planned budget by <strong>₹${exceededAmount.toLocaleString()}</strong>.</div>
        </div>
      ` : ''}

      ${totalBudget > 0 ? `
        <div class="budget-progress-section">
          <div class="progress-header">
            <span>Budget Utilization</span>
            <span>${percentageUsed}% Used</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill ${progressClass}" style="width: ${progressFillWidth}%;"></div>
          </div>
        </div>
      ` : `
        <div class="alert alert-warning" style="margin-top: 1rem; margin-bottom: 0;">
          <span>💡</span>
          <div>Set a total trip budget during trip creation to see active percentage utilization and remaining balance.</div>
        </div>
      `}
    `;

    // Category Breakdown
    if (expenses.length > 0 && categoryBreakdownCard && categoriesList) {
      categoryBreakdownCard.style.display = 'block';
      
      const categoriesMap = {
        'Transport': { label: '🚗 Transport', count: 0, sum: 0, class: 'transport' },
        'Accommodation': { label: '🏨 Accommodation', count: 0, sum: 0, class: 'accommodation' },
        'Food': { label: '🍽️ Food & Dining', count: 0, sum: 0, class: 'food' },
        'Activities': { label: '🎟️ Activities & Sights', count: 0, sum: 0, class: 'activities' },
        'Shopping': { label: '🛍️ Shopping', count: 0, sum: 0, class: 'shopping' },
        'Other': { label: '📦 Other', count: 0, sum: 0, class: 'other' }
      };

      expenses.forEach(e => {
        const cat = e.category || 'Other';
        if (!categoriesMap[cat]) {
          categoriesMap[cat] = { label: `📦 ${cat}`, count: 0, sum: 0, class: 'other' };
        }
        categoriesMap[cat].count += 1;
        categoriesMap[cat].sum += (Number(e.amount) || 0);
      });

      let catHtml = '';
      Object.keys(categoriesMap).forEach(key => {
        const catData = categoriesMap[key];
        if (catData.sum > 0) {
          const catPct = totalExpenses > 0 ? Math.round((catData.sum / totalExpenses) * 100) : 0;
          catHtml += `
            <div class="category-item">
              <div class="category-item-header">
                <span>${catData.label} (${catData.count} ${catData.count === 1 ? 'item' : 'items'})</span>
                <span>₹${catData.sum.toLocaleString()} (${catPct}%)</span>
              </div>
              <div class="category-track">
                <div class="category-fill ${catData.class}" style="width: ${catPct}%;"></div>
              </div>
            </div>
          `;
        }
      });

      categoriesList.innerHTML = catHtml || '<p style="color: var(--text-muted); font-size: 0.875rem;">No category data.</p>';
    } else if (categoryBreakdownCard) {
      categoryBreakdownCard.style.display = 'none';
    }

    // Expenses List
    if (expenses.length === 0) {
      expensesContainer.innerHTML = `
        <div class="state-box" style="padding: 2.5rem 1.5rem;">
          <span class="state-icon">💸</span>
          <div class="state-title">No expenses recorded yet.</div>
          <div class="state-desc">Keep track of your travel spending by logging transport, hotel, food, and activity costs.</div>
          ${!isViewerMode ? `
            <button type="button" class="btn btn-primary btn-add-first-expense">
              <span>+</span> Add Expense
            </button>
          ` : ''}
        </div>
      `;

      const addFirstExpBtn = expensesContainer.querySelector('.btn-add-first-expense');
      if (addFirstExpBtn) {
        addFirstExpBtn.addEventListener('click', openAddExpenseModal);
      }
      return;
    }

    let expHtml = '<div class="expenses-grid">';
    expenses.forEach(item => {
      const catClass = (item.category || 'other').toLowerCase();
      expHtml += `
        <div class="expense-card" data-id="${escapeHtml(item.id)}">
          <div class="expense-info">
            <div class="expense-title-row">
              <span class="expense-title">${escapeHtml(item.title)}</span>
              <span class="badge-category ${escapeHtml(catClass)}">${escapeHtml(item.category || 'Other')}</span>
            </div>
            <div class="expense-meta">
              <span>🗓️ ${formatDate(item.date)}</span>
              ${item.notes ? ` • <span>${escapeHtml(item.notes)}</span>` : ''}
            </div>
          </div>

          <div class="expense-amount-box">
            <div class="expense-amount">₹${Number(item.amount).toLocaleString()}</div>
            ${!isViewerMode ? `
              <div class="activity-actions">
                <button type="button" class="btn-icon btn-edit-expense" data-id="${escapeHtml(item.id)}" title="Edit expense">
                  <span>✏️</span> Edit
                </button>
                <button type="button" class="btn-icon btn-icon-danger btn-delete-expense" data-id="${escapeHtml(item.id)}" title="Delete expense">
                  <span>🗑️</span> Delete
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
    expHtml += '</div>';

    expensesContainer.innerHTML = expHtml;

    if (!isViewerMode) {
      expensesContainer.querySelectorAll('.btn-edit-expense').forEach(btn => {
        btn.addEventListener('click', () => {
          const expId = btn.getAttribute('data-id');
          openEditExpenseModal(expId);
        });
      });

      expensesContainer.querySelectorAll('.btn-delete-expense').forEach(btn => {
        btn.addEventListener('click', () => {
          const expId = btn.getAttribute('data-id');
          handleDeleteExpense(expId);
        });
      });
    }
  }

  // ==========================================================================
  // 6. RENDER COLLABORATORS
  // ==========================================================================
  function renderCollaborators() {
    if (!collaboratorsListContainer || !currentTrip) return;

    const collaborators = currentTrip.collaborators || [];

    if (collaborators.length === 0) {
      collaboratorsListContainer.innerHTML = `
        <div class="state-box" style="padding: 2.5rem 1.5rem;">
          <span class="state-icon">👥</span>
          <div class="state-title">No collaborators yet.</div>
          <div class="state-desc">Invite travel companions via email to share access and collaborate on this trip plan.</div>
          ${!isViewerMode ? `
            <button type="button" class="btn btn-primary btn-add-first-collab">
              <span>+</span> Invite Collaborator
            </button>
          ` : ''}
        </div>
      `;

      const addFirstCollabBtn = collaboratorsListContainer.querySelector('.btn-add-first-collab');
      if (addFirstCollabBtn) {
        addFirstCollabBtn.addEventListener('click', openInviteModal);
      }
      return;
    }

    let html = '<div class="collaborators-grid">';
    collaborators.forEach(c => {
      const displayName = c.name || c.email.split('@')[0];
      const initials = getInitials(displayName);
      const roleClass = (c.role || 'Viewer').toLowerCase();

      html += `
        <div class="collaborator-card" data-id="${escapeHtml(c.id)}">
          <div class="collaborator-profile">
            <div class="collaborator-avatar">${escapeHtml(initials)}</div>
            <div class="collaborator-info">
              <span class="collaborator-name">${escapeHtml(displayName)}</span>
              <span class="collaborator-email">${escapeHtml(c.email)}</span>
              <span class="badge-role ${escapeHtml(roleClass)}">${escapeHtml(c.role || 'Viewer')}</span>
            </div>
          </div>

          ${!isViewerMode ? `
            <div>
              <button type="button" class="btn-icon btn-icon-danger btn-delete-collab" data-id="${escapeHtml(c.id)}" title="Remove collaborator">
                <span>✕</span> Remove
              </button>
            </div>
          ` : ''}
        </div>
      `;
    });
    html += '</div>';

    collaboratorsListContainer.innerHTML = html;

    if (!isViewerMode) {
      collaboratorsListContainer.querySelectorAll('.btn-delete-collab').forEach(btn => {
        btn.addEventListener('click', () => {
          const collabId = btn.getAttribute('data-id');
          handleRemoveCollaborator(collabId);
        });
      });
    }
  }

  async function handleRemoveCollaborator(collabId) {
    if (!currentTrip) return;
    const collab = (currentTrip.collaborators || []).find(c => String(c.id) === String(collabId));
    const name = collab ? (collab.name || collab.email) : 'this collaborator';

    if (window.confirm(`Are you sure you want to remove ${name} from this trip?`)) {
      try {
        await API.removeCollaborator(currentTrip.id, collabId);
        showPageAlert('Collaborator removed.', 'warning');
        loadTripData();
      } catch (err) {
        showPageAlert('Failed to remove collaborator. Please try again.', 'danger');
      }
    }
  }

  // ==========================================================================
  // 7. SHARE TRIP & COPY LINK MODAL LOGIC
  // ==========================================================================
  async function openShareModal() {
    if (!shareModal || !currentTrip) return;

    if (shareCopyFeedback) shareCopyFeedback.innerHTML = '';

    const title = currentTrip.title || currentTrip.name || 'Trip Plan';
    if (shareModalTripInfo) {
      shareModalTripInfo.textContent = `Trip: ${title}`;
    }

    if (shareLinkInput) {
      shareLinkInput.value = 'Generating share link...';
    }

    shareModal.classList.add('is-open');
    shareModal.setAttribute('aria-hidden', 'false');

    try {
      const shareRes = await API.createShareLink(currentTrip.id);
      const token = (shareRes && (shareRes.share_token || shareRes.shareToken)) || currentTrip.id;
      const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : '';
      const fullUrl = origin ? `${origin}/shared-trip.html?token=${encodeURIComponent(token)}` : `shared-trip.html?token=${encodeURIComponent(token)}`;
      if (shareLinkInput) {
        shareLinkInput.value = fullUrl;
      }
    } catch (e) {
      const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : '';
      const fallbackUrl = origin ? `${origin}/shared-trip.html?id=${encodeURIComponent(currentTrip.id)}` : `shared-trip.html?id=${encodeURIComponent(currentTrip.id)}`;
      if (shareLinkInput) {
        shareLinkInput.value = fallbackUrl;
      }
    }
  }

  function closeShareModal() {
    if (!shareModal) return;
    shareModal.classList.remove('is-open');
    shareModal.setAttribute('aria-hidden', 'true');
  }

  function handleCopyShareLink() {
    if (!shareLinkInput) return;
    const url = shareLinkInput.value.trim();

    if (!url) {
      if (shareCopyFeedback) {
        shareCopyFeedback.innerHTML = '<span style="color: var(--danger);">Sharing link is not available yet.</span>';
      }
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        if (copyShareLinkBtn) copyShareLinkBtn.innerHTML = '<span>✓</span> Copied!';
        if (shareCopyFeedback) {
          shareCopyFeedback.innerHTML = '<span style="color: var(--success); font-weight: 600;">✓ Trip link copied to clipboard!</span>';
        }
        setTimeout(() => {
          if (copyShareLinkBtn) copyShareLinkBtn.innerHTML = '<span>📋</span> Copy Link';
        }, 3000);
      }).catch(() => {
        fallbackCopyText(url);
      });
    } else {
      fallbackCopyText(url);
    }
  }

  function fallbackCopyText(text) {
    shareLinkInput.select();
    try {
      document.execCommand('copy');
      if (shareCopyFeedback) {
        shareCopyFeedback.innerHTML = '<span style="color: var(--success); font-weight: 600;">✓ Trip link copied!</span>';
      }
    } catch (err) {
      if (shareCopyFeedback) {
        shareCopyFeedback.innerHTML = '<span style="color: var(--danger);">Could not copy link automatically. Please select and copy manually.</span>';
      }
    }
  }

  // ==========================================================================
  // 8. INVITE COLLABORATOR MODAL LOGIC
  // ==========================================================================
  function openInviteModal() {
    if (!inviteModal || !inviteCollaboratorForm) return;
    clearInviteModalAlerts();
    inviteCollaboratorForm.reset();
    inviteModal.classList.add('is-open');
    inviteModal.setAttribute('aria-hidden', 'false');
    if (inviteEmailInput) inviteEmailInput.focus();
  }

  function closeInviteModal() {
    if (!inviteModal) return;
    inviteModal.classList.remove('is-open');
    inviteModal.setAttribute('aria-hidden', 'true');
    clearInviteModalAlerts();
  }

  async function handleInviteFormSubmit(e) {
    e.preventDefault();
    clearInviteModalAlerts();

    const email = inviteEmailInput ? inviteEmailInput.value.trim() : '';
    const name = inviteNameInput ? inviteNameInput.value.trim() : '';
    const role = inviteRoleInput ? inviteRoleInput.value.trim() : 'Viewer';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showInviteModalAlert('Please enter a valid email address.');
      if (inviteEmailInput) inviteEmailInput.focus();
      return;
    }

    if (sendInviteSubmitBtn) {
      sendInviteSubmitBtn.disabled = true;
      sendInviteSubmitBtn.innerHTML = '<span>⏳</span> Sending...';
    }

    try {
      await API.inviteCollaborator(currentTrip.id, { email, name, role });
      closeInviteModal();
      showPageAlert(`Invitation sent to ${email} as ${role}!`, 'success');
      loadTripData();
    } catch (err) {
      showInviteModalAlert(err.message || 'Failed to send collaborator invitation.');
    } finally {
      if (sendInviteSubmitBtn) {
        sendInviteSubmitBtn.disabled = false;
        sendInviteSubmitBtn.innerHTML = '<span>📨</span> Send Invitation';
      }
    }
  }

  function applyRolePermissions() {
    if (isViewerMode) {
      if (readOnlyBanner) readOnlyBanner.style.display = 'flex';
      if (openAddActivityBtn) openAddActivityBtn.style.display = 'none';
      if (openAddExpenseBtn) openAddExpenseBtn.style.display = 'none';
      if (openInviteModalBtn) openInviteModalBtn.style.display = 'none';
    } else {
      if (readOnlyBanner) readOnlyBanner.style.display = 'none';
    }
  }

  // ==========================================================================
  // 9. EVENT LISTENERS SETUP
  // ==========================================================================
  function setupEventListeners() {
    // Activity Modal Listeners
    if (openAddActivityBtn) openAddActivityBtn.addEventListener('click', openAddModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    if (activityModal) {
      activityModal.addEventListener('click', (e) => {
        if (e.target === activityModal) closeModal();
      });
    }

    if (activityForm) {
      activityForm.addEventListener('submit', handleActivityFormSubmit);
    }

    // Expense Modal Listeners
    if (openAddExpenseBtn) openAddExpenseBtn.addEventListener('click', openAddExpenseModal);
    if (closeExpenseModalBtn) closeExpenseModalBtn.addEventListener('click', closeExpenseModal);
    if (cancelExpenseModalBtn) cancelExpenseModalBtn.addEventListener('click', closeExpenseModal);

    if (expenseModal) {
      expenseModal.addEventListener('click', (e) => {
        if (e.target === expenseModal) closeExpenseModal();
      });
    }

    if (expenseForm) {
      expenseForm.addEventListener('submit', handleExpenseFormSubmit);
    }

    // Share Modal Listeners
    if (closeShareModalBtn) closeShareModalBtn.addEventListener('click', closeShareModal);
    if (cancelShareModalBtn) cancelShareModalBtn.addEventListener('click', closeShareModal);
    if (copyShareLinkBtn) copyShareLinkBtn.addEventListener('click', handleCopyShareLink);

    if (shareModal) {
      shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) closeShareModal();
      });
    }

    // Invite Modal Listeners
    if (openInviteModalBtn) openInviteModalBtn.addEventListener('click', openInviteModal);
    if (closeInviteModalBtn) closeInviteModalBtn.addEventListener('click', closeInviteModal);
    if (cancelInviteModalBtn) cancelInviteModalBtn.addEventListener('click', closeInviteModal);

    if (inviteModal) {
      inviteModal.addEventListener('click', (e) => {
        if (e.target === inviteModal) closeInviteModal();
      });
    }

    if (inviteCollaboratorForm) {
      inviteCollaboratorForm.addEventListener('submit', handleInviteFormSubmit);
    }

    // Global Key Listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (activityModal && activityModal.classList.contains('is-open')) closeModal();
        if (expenseModal && expenseModal.classList.contains('is-open')) closeExpenseModal();
        if (shareModal && shareModal.classList.contains('is-open')) closeShareModal();
        if (inviteModal && inviteModal.classList.contains('is-open')) closeInviteModal();
      }
    });
  }

  // ==========================================================================
  // 10. ACTIVITY & EXPENSE MODALS HELPERS
  // ==========================================================================
  function openAddModal() {
    if (!activityModal || !activityForm) return;
    clearModalAlerts();
    activityForm.reset();
    editingActivityIdInput.value = '';
    modalTitle.textContent = 'Add Activity to Itinerary';
    if (saveActivitySubmitBtn) saveActivitySubmitBtn.innerHTML = '<span>💾</span> Save Activity';

    if (currentTrip && currentTrip.startDate && activityDateInput) {
      activityDateInput.value = currentTrip.startDate;
    } else if (activityDateInput) {
      activityDateInput.value = new Date().toISOString().split('T')[0];
    }

    if (currentTrip && currentTrip.destination && activityLocationInput && !activityLocationInput.value) {
      activityLocationInput.value = currentTrip.destination;
    }

    activityModal.classList.add('is-open');
    activityModal.setAttribute('aria-hidden', 'false');
    if (activityNameInput) activityNameInput.focus();
  }

  function openEditModal(activityId) {
    if (!activityModal || !activityForm || !currentTrip) return;
    const activity = (currentTrip.itinerary || []).find(i => String(i.id) === String(activityId));
    if (!activity) return;

    clearModalAlerts();
    editingActivityIdInput.value = activity.id;
    modalTitle.textContent = 'Edit Itinerary Activity';
    if (saveActivitySubmitBtn) saveActivitySubmitBtn.innerHTML = '<span>💾</span> Update Activity';

    activityDateInput.value = activity.date || '';
    activityTimeInput.value = activity.time || '';
    activityNameInput.value = activity.activity || '';
    activityLocationInput.value = activity.location || '';
    activityLatInput.value = activity.latitude !== undefined ? activity.latitude : (activity.lat || '');
    activityLngInput.value = activity.longitude !== undefined ? activity.longitude : (activity.lng || '');
    activityNotesInput.value = activity.notes || '';

    activityModal.classList.add('is-open');
    activityModal.setAttribute('aria-hidden', 'false');
    if (activityNameInput) activityNameInput.focus();
  }

  function closeModal() {
    if (!activityModal) return;
    activityModal.classList.remove('is-open');
    activityModal.setAttribute('aria-hidden', 'true');
    clearModalAlerts();
  }

  async function handleActivityFormSubmit(e) {
    e.preventDefault();
    clearModalAlerts();

    const date = activityDateInput ? activityDateInput.value.trim() : '';
    const time = activityTimeInput ? activityTimeInput.value.trim() : '';
    const name = activityNameInput ? activityNameInput.value.trim() : '';
    const location = activityLocationInput ? activityLocationInput.value.trim() : '';
    const notes = activityNotesInput ? activityNotesInput.value.trim() : '';
    const latStr = activityLatInput ? activityLatInput.value.trim() : '';
    const lngStr = activityLngInput ? activityLngInput.value.trim() : '';
    const editingId = editingActivityIdInput ? editingActivityIdInput.value.trim() : '';

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

    let lat = null;
    let lng = null;
    if (latStr || lngStr) {
      lat = parseFloat(latStr);
      lng = parseFloat(lngStr);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        showModalAlert('Latitude must be a valid number between -90 and 90.', 'danger');
        if (activityLatInput) activityLatInput.focus();
        return;
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        showModalAlert('Longitude must be a valid number between -180 and 180.', 'danger');
        if (activityLngInput) activityLngInput.focus();
        return;
      }
    }

    const activityData = {
      date,
      time,
      activity: name,
      location,
      notes,
      latitude: lat !== null ? lat : undefined,
      longitude: lng !== null ? lng : undefined
    };

    if (saveActivitySubmitBtn) {
      saveActivitySubmitBtn.disabled = true;
      saveActivitySubmitBtn.innerHTML = '<span>⏳</span> Saving...';
    }

    try {
      if (editingId) {
        await API.updateItineraryItem(currentTrip.id, editingId, activityData);
        showPageAlert(`Activity "${name}" updated successfully!`, 'success');
      } else {
        await API.addItineraryItem(currentTrip.id, activityData);
        showPageAlert(`Activity "${name}" added to itinerary!`, 'success');
      }

      closeModal();
      loadTripData();
    } catch (err) {
      showModalAlert(err.message || 'Failed to save activity. Please try again.');
    } finally {
      if (saveActivitySubmitBtn) {
        saveActivitySubmitBtn.disabled = false;
        saveActivitySubmitBtn.innerHTML = editingId ? '<span>💾</span> Update Activity' : '<span>💾</span> Save Activity';
      }
    }
  }

  async function handleDeleteActivity(activityId) {
    if (!currentTrip) return;
    const activity = (currentTrip.itinerary || []).find(i => String(i.id) === String(activityId));
    const activityName = activity ? `"${activity.activity}"` : 'this activity';

    if (window.confirm(`Are you sure you want to delete ${activityName} from your itinerary?`)) {
      try {
        await API.deleteItineraryItem(currentTrip.id, activityId);
        showPageAlert('Activity deleted successfully.', 'warning');
        loadTripData();
      } catch (err) {
        showPageAlert('Failed to delete activity. Please try again.', 'danger');
      }
    }
  }

  function openAddExpenseModal() {
    if (!expenseModal || !expenseForm) return;
    clearExpenseModalAlerts();
    expenseForm.reset();
    editingExpenseIdInput.value = '';
    expenseModalTitle.textContent = 'Add Trip Expense';
    if (saveExpenseSubmitBtn) saveExpenseSubmitBtn.innerHTML = '<span>💾</span> Save Expense';

    if (currentTrip && currentTrip.startDate && expenseDateInput) {
      expenseDateInput.value = currentTrip.startDate;
    } else if (expenseDateInput) {
      expenseDateInput.value = new Date().toISOString().split('T')[0];
    }

    expenseModal.classList.add('is-open');
    expenseModal.setAttribute('aria-hidden', 'false');
    if (expenseTitleInput) expenseTitleInput.focus();
  }

  function openEditExpenseModal(expenseId) {
    if (!expenseModal || !expenseForm || !currentTrip) return;
    const expense = (currentTrip.expenses || []).find(e => String(e.id) === String(expenseId));
    if (!expense) return;

    clearExpenseModalAlerts();
    editingExpenseIdInput.value = expense.id;
    expenseModalTitle.textContent = 'Edit Expense Entry';
    if (saveExpenseSubmitBtn) saveExpenseSubmitBtn.innerHTML = '<span>💾</span> Update Expense';

    expenseTitleInput.value = expense.title || '';
    expenseCategoryInput.value = expense.category || '';
    expenseAmountInput.value = expense.amount || '';
    expenseDateInput.value = expense.date || '';
    expenseNotesInput.value = expense.notes || '';

    expenseModal.classList.add('is-open');
    expenseModal.setAttribute('aria-hidden', 'false');
    if (expenseTitleInput) expenseTitleInput.focus();
  }

  function closeExpenseModal() {
    if (!expenseModal) return;
    expenseModal.classList.remove('is-open');
    expenseModal.setAttribute('aria-hidden', 'true');
    clearExpenseModalAlerts();
  }

  async function handleExpenseFormSubmit(e) {
    e.preventDefault();
    clearExpenseModalAlerts();

    const title = expenseTitleInput ? expenseTitleInput.value.trim() : '';
    const category = expenseCategoryInput ? expenseCategoryInput.value.trim() : '';
    const amountVal = expenseAmountInput ? parseFloat(expenseAmountInput.value) : 0;
    const date = expenseDateInput ? expenseDateInput.value.trim() : '';
    const notes = expenseNotesInput ? expenseNotesInput.value.trim() : '';
    const editingId = editingExpenseIdInput ? editingExpenseIdInput.value.trim() : '';

    if (!title) {
      showExpenseModalAlert('Expense title is required.', 'danger');
      if (expenseTitleInput) expenseTitleInput.focus();
      return;
    }

    if (!category) {
      showExpenseModalAlert('Please select an expense category.', 'danger');
      if (expenseCategoryInput) expenseCategoryInput.focus();
      return;
    }

    if (isNaN(amountVal) || amountVal <= 0) {
      showExpenseModalAlert('Amount must be a positive number greater than 0.', 'danger');
      if (expenseAmountInput) expenseAmountInput.focus();
      return;
    }

    if (!date) {
      showExpenseModalAlert('Expense date is required.', 'danger');
      if (expenseDateInput) expenseDateInput.focus();
      return;
    }

    const expenseData = { title, category, amount: amountVal, date, notes };

    if (saveExpenseSubmitBtn) {
      saveExpenseSubmitBtn.disabled = true;
      saveExpenseSubmitBtn.innerHTML = '<span>⏳</span> Saving...';
    }

    try {
      if (editingId) {
        await API.updateExpense(currentTrip.id, editingId, expenseData);
        showPageAlert(`Expense "${title}" updated successfully!`, 'success');
      } else {
        await API.addExpense(currentTrip.id, expenseData);
        showPageAlert(`Expense "${title}" (₹${amountVal.toLocaleString()}) recorded!`, 'success');
      }

      closeExpenseModal();
      loadTripData();
    } catch (err) {
      showExpenseModalAlert(err.message || 'Failed to save expense. Please try again.');
    } finally {
      if (saveExpenseSubmitBtn) {
        saveExpenseSubmitBtn.disabled = false;
        saveExpenseSubmitBtn.innerHTML = editingId ? '<span>💾</span> Update Expense' : '<span>💾</span> Save Expense';
      }
    }
  }

  async function handleDeleteExpense(expenseId) {
    if (!currentTrip) return;
    const expense = (currentTrip.expenses || []).find(e => String(e.id) === String(expenseId));
    const expenseTitle = expense ? `"${expense.title}"` : 'this expense';

    if (window.confirm(`Are you sure you want to delete ${expenseTitle}?`)) {
      try {
        await API.deleteExpense(currentTrip.id, expenseId);
        showPageAlert('Expense deleted successfully.', 'warning');
        loadTripData();
      } catch (err) {
        showPageAlert('Failed to delete expense. Please try again.', 'danger');
      }
    }
  }

  // ==========================================================================
  // 11. GENERAL HELPERS
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

  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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

  function showExpenseModalAlert(message, type = 'danger') {
    if (!expenseModalAlertContainer) return;
    expenseModalAlertContainer.innerHTML = `
      <div class="alert alert-${type}">
        <span>⚠️</span>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
  }

  function clearExpenseModalAlerts() {
    if (expenseModalAlertContainer) expenseModalAlertContainer.innerHTML = '';
  }

  function showInviteModalAlert(message, type = 'danger') {
    if (!inviteModalAlertContainer) return;
    inviteModalAlertContainer.innerHTML = `
      <div class="alert alert-${type}">
        <span>⚠️</span>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
  }

  function clearInviteModalAlerts() {
    if (inviteModalAlertContainer) inviteModalAlertContainer.innerHTML = '';
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
