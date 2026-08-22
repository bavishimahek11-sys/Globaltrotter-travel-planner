/**
 * GlobalTrotter - Dedicated Map & Route Visualization JS (Phase 7 Clean Architecture)
 * Renders real travel routes, sequence polylines, and waypoints using Leaflet.js and API client.
 *
 * NOTE: Strictly no fake locations, fake coordinates, or localStorage database logic.
 */

document.addEventListener('DOMContentLoaded', () => {
  const mapHeroTitle = document.getElementById('mapHeroTitle');
  const mapTripInfo = document.getElementById('mapTripInfo');
  const standaloneMapEl = document.getElementById('standaloneMap');
  const standaloneMapEmptyState = document.getElementById('standaloneMapEmptyState');
  const standaloneMapBadge = document.getElementById('standaloneMapBadge');
  const mapWaypointsListContainer = document.getElementById('mapWaypointsListContainer');
  const mapWaypointsList = document.getElementById('mapWaypointsList');

  // Trip selection
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get('id');
  let currentTrip = null;

  let mapInstance = null;
  let layerGroup = null;

  loadMapData();

  async function loadMapData() {
    if (!tripId) {
      renderNoTripState();
      return;
    }

    try {
      currentTrip = await API.getTripById(tripId);
      if (!currentTrip) {
        renderNoTripState();
        return;
      }
      initStandaloneMap();
    } catch (err) {
      console.warn('Map trip data loading error:', err.message);
      renderErrorState();
    }
  }

  function renderNoTripState() {
    if (standaloneMapEmptyState) {
      standaloneMapEmptyState.style.display = 'block';
      standaloneMapEmptyState.innerHTML = `
        <span class="state-icon">🎒</span>
        <div class="state-title">No Trip Selected</div>
        <div class="state-desc">Select a trip from your dashboard or plan a new trip to visualize your route on the map.</div>
        <div style="margin-top: 1.25rem;">
          <a href="create-trip.html" class="btn btn-primary btn-sm">Plan a Trip</a>
        </div>
      `;
    }
    if (standaloneMapBadge) standaloneMapBadge.textContent = '0 locations';
  }

  function renderErrorState() {
    if (standaloneMapEmptyState) {
      standaloneMapEmptyState.style.display = 'block';
      standaloneMapEmptyState.innerHTML = `
        <span class="state-icon">⚠️</span>
        <div class="state-title">Unable to Load Map Data</div>
        <div class="state-desc">Could not connect to the backend server. Please verify your connection and try again.</div>
        <div style="margin-top: 1.25rem;">
          <button type="button" id="retryMapBtn" class="btn btn-primary btn-sm">
            <span>🔄</span> Retry
          </button>
        </div>
      `;

      const retryBtn = document.getElementById('retryMapBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', loadMapData);
      }
    }
  }

  function initStandaloneMap() {
    if (!standaloneMapEl || typeof L === 'undefined' || !currentTrip) return;

    const title = currentTrip.title || `Trip to ${currentTrip.toCity || 'Destination'}`;
    if (mapHeroTitle) mapHeroTitle.textContent = `${title} — Map`;
    if (mapTripInfo) mapTripInfo.textContent = `Route: ${currentTrip.fromCity || 'Origin'} ➔ ${currentTrip.toCity || 'Destination'}`;

    try {
      if (!mapInstance) {
        mapInstance = L.map('standaloneMap', {
          zoomControl: true,
          scrollWheelZoom: true
        }).setView([20.5937, 78.9629], 5);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance);

        layerGroup = L.featureGroup().addTo(mapInstance);
      }

      renderWaypointsOnMap();
    } catch (e) {
      console.warn('Standalone map initialization error:', e);
    }
  }

  function renderWaypointsOnMap() {
    if (!mapInstance || !layerGroup || !currentTrip) return;

    layerGroup.clearLayers();
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
        const point = {
          lat,
          lng,
          id: `dest-${dest.id || idx}`,
          title: dest.city || dest.name || `${role} Location`,
          location: dest.country ? `${dest.city || dest.name}, ${dest.country}` : (dest.city || dest.name || ''),
          date: dest.visit_date || '',
          time: '',
          notes: dest.notes || '',
          index: validPoints.length + 1,
          role: role
        };
        validPoints.push(point);

        const marker = L.marker([lat, lng]).addTo(layerGroup);
        const popupContent = `
          <div class="map-popup-card">
            <div class="map-popup-title">${role === 'Origin' ? '🏁' : (role === 'Destination' ? '🎯' : '📍')} ${escapeHtml(point.title)}</div>
            <div class="map-popup-meta"><strong>${role}</strong> ${point.location ? `• ${escapeHtml(point.location)}` : ''}</div>
            ${point.notes ? `<div class="map-popup-notes">${escapeHtml(point.notes)}</div>` : ''}
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
          index: validPoints.length + 1,
          role: 'Origin'
        };
        validPoints.push(startPoint);
        const startMarker = L.marker([startLat, startLng]).addTo(layerGroup);
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
          index: validPoints.length + 1,
          role: 'Destination'
        };
        validPoints.push(destPoint);
        const destMarker = L.marker([destLat, destLng]).addTo(layerGroup);
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
          const point = {
            lat,
            lng,
            id: item.id,
            title: item.activity || 'Activity Location',
            location: item.location || '',
            date: item.date || '',
            time: item.time || '',
            notes: item.notes || '',
            index: validPoints.length + 1,
            role: 'Activity'
          };
          validPoints.push(point);

          const marker = L.marker([lat, lng]).addTo(layerGroup);
          const popupContent = `
            <div class="map-popup-card">
              <div class="map-popup-title">#${point.index} ${escapeHtml(point.title)}</div>
              <div class="map-popup-meta">📍 ${escapeHtml(point.location)} ${point.time ? `• ⏰ ${point.time}` : ''}</div>
              ${point.notes ? `<div class="map-popup-notes">${escapeHtml(point.notes)}</div>` : ''}
            </div>
          `;
          marker.bindPopup(popupContent);
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
      }).addTo(layerGroup);
    }

    if (validPoints.length > 0) {
      if (standaloneMapEmptyState) standaloneMapEmptyState.style.display = 'none';
      if (standaloneMapBadge) standaloneMapBadge.textContent = `${validPoints.length} location${validPoints.length === 1 ? '' : 's'} plotted`;

      try {
        mapInstance.fitBounds(layerGroup.getBounds(), { padding: [50, 50], maxZoom: 14 });
      } catch (e) {
        mapInstance.setView([validPoints[0].lat, validPoints[0].lng], 11);
      }

      // Render waypoints list below map
      if (mapWaypointsListContainer && mapWaypointsList) {
        mapWaypointsListContainer.style.display = 'block';
        let listHtml = '';
        validPoints.forEach(p => {
          listHtml += `
            <div class="timeline-content" style="cursor: pointer;" data-lat="${p.lat}" data-lng="${p.lng}">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="day-badge" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;">#${p.index}</span>
                <strong>${escapeHtml(p.title)}</strong>
                <span style="color: var(--text-muted); font-size: 0.85rem;">(${escapeHtml(p.location || p.role || '')})</span>
              </div>
              <span style="color: var(--primary); font-size: 0.8rem; font-weight: 600;">[ ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} ]</span>
            </div>
          `;
        });
        mapWaypointsList.innerHTML = listHtml;

        mapWaypointsList.querySelectorAll('.timeline-content').forEach(item => {
          item.addEventListener('click', () => {
            const lat = parseFloat(item.getAttribute('data-lat'));
            const lng = parseFloat(item.getAttribute('data-lng'));
            mapInstance.setView([lat, lng], 14, { animate: true });
          });
        });
      }
    } else {
      if (standaloneMapEmptyState) {
        standaloneMapEmptyState.style.display = 'block';
        standaloneMapEmptyState.innerHTML = `
          <span class="state-icon">📍</span>
          <div class="state-title">Location data is not available for this trip.</div>
          <div class="state-desc">Automatic geocoding could not determine coordinates for the entered locations, or no location coordinates were provided.</div>
        `;
      }
      if (standaloneMapBadge) standaloneMapBadge.textContent = '0 locations plotted';
      if (mapWaypointsListContainer) mapWaypointsListContainer.style.display = 'none';
    }

    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 200);
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
