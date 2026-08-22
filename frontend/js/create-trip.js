/**
 * GlobalTrotter - Smart Stop Suggestions (Frontend Phase 1)
 * Handles route selection, smart stop lookups via mock data, dynamic card rendering,
 * and client-side Add to Trip interaction.
 *
 * NOTE: Strictly no fake users or backend calls in this frontend-only prototype.
 */

// ==========================================================================
// ISOLATED MOCK DATA FOR UI PROTOTYPING
// ==========================================================================
const MOCK_SMART_STOPS = [
  {
    from: "Ahmedabad",
    to: "Mumbai",
    stops: [
      {
        city: "Vadodara",
        category: "Heritage • Food",
        duration: "4–6 hours",
        description: "Marvel at the majestic Laxmi Vilas Palace and savor authentic Gujarati thali and street savories along the expressway."
      },
      {
        city: "Champaner",
        category: "History • Culture",
        duration: "3–5 hours",
        description: "Explore UNESCO World Heritage Pavagadh-Champaner archaeological park with ancient mosques and hill fortress views."
      },
      {
        city: "Surat",
        category: "Culinary • Textiles",
        duration: "3–4 hours",
        description: "Known for world-famous diamonds, rich silk textiles, and incredible culinary delights like Locho and Ghari."
      }
    ]
  },
  {
    from: "Delhi",
    to: "Jaipur",
    stops: [
      {
        city: "Neemrana",
        category: "Fort • Heritage",
        duration: "2–4 hours",
        description: "Visit the 15th-century Neemrana Fort-Palace on the Delhi-Jaipur highway featuring stepwells and vintage charm."
      },
      {
        city: "Murthal",
        category: "Food • Highway Culture",
        duration: "1–2 hours",
        description: "Famous roadside culinary hub legendary for hot tandoori paranthas with fresh white butter."
      }
    ]
  },
  {
    from: "Mumbai",
    to: "Goa",
    stops: [
      {
        city: "Kolhapur",
        category: "Temples • Cuisine",
        duration: "3–4 hours",
        description: "Historic city renowned for the historic Mahalaxmi Temple, traditional leather footwear, and spicy Kolhapuri cuisine."
      },
      {
        city: "Ratnagiri",
        category: "Coastal • Nature",
        duration: "4–5 hours",
        description: "Scenic Konkan coastal town with Alphonso mango orchards, Jaigad lighthouse, and pristine beaches."
      },
      {
        city: "Lonavala",
        category: "Hill Station • Nature",
        duration: "2–3 hours",
        description: "Iconic Western Ghats getaway with scenic viewpoints, lush waterfalls, and traditional chikki snacks."
      }
    ]
  },
  {
    from: "Bangalore",
    to: "Chennai",
    stops: [
      {
        city: "Vellore",
        category: "Fort • Architecture",
        duration: "2–3 hours",
        description: "Home to the massive 16th-century granite Vellore Fort, Golden Temple (Sripuram), and rich Chola-Vijayanagar history."
      },
      {
        city: "Kanchipuram",
        category: "Silk • Temples",
        duration: "3–4 hours",
        description: "The City of Thousand Temples celebrated worldwide for magnificent temple architecture and handwoven silk sarees."
      }
    ]
  }
];

// ==========================================================================
// DOM ELEMENTS & INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const fromCitySelect = document.getElementById('fromCity');
  const toCitySelect = document.getElementById('toCity');
  const findStopsBtn = document.getElementById('findStopsBtn');
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  const smartStopsSection = document.getElementById('smartStopsSection');
  const alertContainer = document.getElementById('alertContainer');
  const timelineOrigin = document.getElementById('timelineOrigin');
  const timelineDestination = document.getElementById('timelineDestination');
  const timelineStopsList = document.getElementById('timelineStopsList');
  const timelineEmpty = document.getElementById('timelineEmpty');
  const activeRouteBadge = document.getElementById('activeRouteBadge');

  // Load any previously selected trip from sessionStorage
  initActiveTrip();

  // Event Listeners
  if (findStopsBtn) {
    findStopsBtn.addEventListener('click', handleFindStops);
  }

  // Auto-search on select change if both are filled
  if (fromCitySelect && toCitySelect) {
    fromCitySelect.addEventListener('change', () => {
      if (fromCitySelect.value && toCitySelect.value) {
        handleFindStops();
      }
    });

    toCitySelect.addEventListener('change', () => {
      if (fromCitySelect.value && toCitySelect.value) {
        handleFindStops();
      }
    });
  }

  // Quick route chips
  const routeChips = document.querySelectorAll('.route-chip');
  routeChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      const from = chip.getAttribute('data-from');
      const to = chip.getAttribute('data-to');
      if (from && to && fromCitySelect && toCitySelect) {
        fromCitySelect.value = from;
        toCitySelect.value = to;
        handleFindStops();
      }
    });
  });

  // ==========================================================================
  // CORE FUNCTIONS
  // ==========================================================================

  /**
   * Initializes trip timeline with existing session data
   */
  function initActiveTrip() {
    const trip = Storage.getActiveTrip();
    if (trip.fromCity && fromCitySelect) fromCitySelect.value = trip.fromCity;
    if (trip.toCity && toCitySelect) toCitySelect.value = trip.toCity;
    updateTimelineUI();

    // If both cities are already stored, trigger search automatically
    if (trip.fromCity && trip.toCity) {
      handleFindStops();
    }
  }

  /**
   * Finds matching stops from mock data
   */
  function findMatchingStops(fromCity, toCity) {
    const from = fromCity.trim().toLowerCase();
    const to = toCity.trim().toLowerCase();

    // Check direct route or reverse route
    const route = MOCK_SMART_STOPS.find(r => 
      (r.from.toLowerCase() === from && r.to.toLowerCase() === to) ||
      (r.from.toLowerCase() === to && r.to.toLowerCase() === from)
    );

    return route ? route.stops : [];
  }

  /**
   * Main search handler
   */
  function handleFindStops() {
    const fromCity = fromCitySelect ? fromCitySelect.value.trim() : '';
    const toCity = toCitySelect ? toCitySelect.value.trim() : '';

    // Clear previous alerts
    clearAlert();

    // Validation
    if (!fromCity || !toCity) {
      showAlert('Please select both a departure city (From) and a destination city (To).', 'warning');
      return;
    }

    if (fromCity.toLowerCase() === toCity.toLowerCase()) {
      showAlert('From City and To City cannot be the same. Please choose different destinations.', 'warning');
      return;
    }

    // Save route to storage
    Storage.setRoute(fromCity, toCity);
    updateTimelineUI();

    // Show Smart Stops Section
    if (smartStopsSection) {
      smartStopsSection.style.display = 'block';
    }

    if (activeRouteBadge) {
      activeRouteBadge.textContent = `${fromCity} ➔ ${toCity}`;
    }

    // Show Loading State
    showLoadingState(fromCity, toCity);

    // Simulate natural response transition (300ms)
    setTimeout(() => {
      const stops = findMatchingStops(fromCity, toCity);
      renderSuggestions(stops, fromCity, toCity);
    }, 300);
  }

  /**
   * Displays loading state UI
   */
  function showLoadingState(from, to) {
    if (!suggestionsContainer) return;
    suggestionsContainer.innerHTML = `
      <div class="state-box">
        <div class="spinner"></div>
        <div class="state-title">Finding Smart Stops...</div>
        <div class="state-desc">Discovering interesting intermediate destinations between <strong>${escapeHtml(from)}</strong> and <strong>${escapeHtml(to)}</strong></div>
      </div>
    `;
  }

  /**
   * Renders suggestion cards or empty state
   */
  function renderSuggestions(stops, from, to) {
    if (!suggestionsContainer) return;

    if (!stops || stops.length === 0) {
      suggestionsContainer.innerHTML = `
        <div class="state-box">
          <span class="state-icon">🗺️</span>
          <div class="state-title">No smart stops found for this route</div>
          <div class="state-desc">We currently don't have curated intermediate stops between <strong>${escapeHtml(from)}</strong> and <strong>${escapeHtml(to)}</strong>. Try popular routes like <em>Ahmedabad ➔ Mumbai</em>, <em>Delhi ➔ Jaipur</em>, or <em>Mumbai ➔ Goa</em>.</div>
        </div>
      `;
      return;
    }

    // Create cards grid
    const grid = document.createElement('div');
    grid.className = 'suggestions-grid';

    stops.forEach((stop, index) => {
      const isAdded = Storage.isStopAdded(stop.city);
      const card = document.createElement('div');
      card.className = `stop-card ${isAdded ? 'is-selected' : ''}`;
      card.id = `stop-card-${index}`;

      card.innerHTML = `
        <div>
          <div class="stop-header">
            <h3 class="stop-title">📍 ${escapeHtml(stop.city)}</h3>
          </div>
          <span class="stop-tag">${escapeHtml(stop.category)}</span>
          <div class="stop-duration">
            <span>⏱</span> Suggested stop: <strong>${escapeHtml(stop.duration)}</strong>
          </div>
          <p class="stop-desc">${escapeHtml(stop.description)}</p>
        </div>
        <div class="stop-footer">
          <button type="button" class="btn btn-add ${isAdded ? 'is-added' : ''}" data-city="${escapeHtml(stop.city)}">
            ${isAdded ? '✓ Added to Trip' : '+ Add to Trip'}
          </button>
        </div>
      `;

      // Button interaction
      const btn = card.querySelector('.btn-add');
      btn.addEventListener('click', () => {
        handleToggleStop(stop, card, btn);
      });

      grid.appendChild(card);
    });

    suggestionsContainer.innerHTML = '';
    suggestionsContainer.appendChild(grid);
  }

  /**
   * Handles Add to Trip / Remove toggle
   */
  function handleToggleStop(stop, card, btn) {
    const isCurrentlyAdded = Storage.isStopAdded(stop.city);

    if (isCurrentlyAdded) {
      // Remove stop
      Storage.removeStop(stop.city);
      btn.classList.remove('is-added');
      btn.textContent = '+ Add to Trip';
      card.classList.remove('is-selected');
    } else {
      // Add stop
      Storage.addStop(stop);
      btn.classList.add('is-added');
      btn.textContent = '✓ Added to Trip';
      card.classList.add('is-selected');
    }

    updateTimelineUI();
  }

  /**
   * Updates the sidebar/bottom trip route timeline
   */
  function updateTimelineUI() {
    const trip = Storage.getActiveTrip();

    if (!timelineOrigin || !timelineDestination || !timelineStopsList) return;

    if (!trip.fromCity && !trip.toCity && (!trip.addedStops || trip.addedStops.length === 0)) {
      if (timelineEmpty) timelineEmpty.style.display = 'block';
      if (timelineOrigin) timelineOrigin.style.display = 'none';
      if (timelineDestination) timelineDestination.style.display = 'none';
      if (timelineStopsList) timelineStopsList.innerHTML = '';
      return;
    }

    if (timelineEmpty) timelineEmpty.style.display = 'none';

    // Origin
    if (trip.fromCity) {
      timelineOrigin.style.display = 'block';
      const nameEl = timelineOrigin.querySelector('.timeline-name');
      if (nameEl) nameEl.textContent = trip.fromCity;
    } else {
      timelineOrigin.style.display = 'none';
    }

    // Intermediate stops
    timelineStopsList.innerHTML = '';
    if (trip.addedStops && trip.addedStops.length > 0) {
      trip.addedStops.forEach(stop => {
        const li = document.createElement('li');
        li.className = 'timeline-item';
        li.innerHTML = `
          <div class="timeline-dot stop"></div>
          <div class="timeline-content">
            <div>
              <div class="timeline-name">📍 ${escapeHtml(stop.city)}</div>
              <div class="timeline-type">${escapeHtml(stop.category || 'Suggested Stop')} • ${escapeHtml(stop.duration || '')}</div>
            </div>
            <button type="button" class="btn-remove-stop" title="Remove stop" data-city="${escapeHtml(stop.city)}">✕</button>
          </div>
        `;

        // Handle remove from timeline
        const removeBtn = li.querySelector('.btn-remove-stop');
        removeBtn.addEventListener('click', () => {
          Storage.removeStop(stop.city);
          updateTimelineUI();
          // Update card button in suggestions grid if visible
          const activeBtn = document.querySelector(`.btn-add[data-city="${stop.city}"]`);
          if (activeBtn) {
            activeBtn.classList.remove('is-added');
            activeBtn.textContent = '+ Add to Trip';
            const parentCard = activeBtn.closest('.stop-card');
            if (parentCard) parentCard.classList.remove('is-selected');
          }
        });

        timelineStopsList.appendChild(li);
      });
    }

    // Destination
    if (trip.toCity) {
      timelineDestination.style.display = 'block';
      const nameEl = timelineDestination.querySelector('.timeline-name');
      if (nameEl) nameEl.textContent = trip.toCity;
    } else {
      timelineDestination.style.display = 'none';
    }
  }

  /**
   * Alert Helpers
   */
  function showAlert(message, type = 'warning') {
    if (!alertContainer) return;
    alertContainer.innerHTML = `
      <div class="alert alert-${type}">
        <span>⚠️</span>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
  }

  function clearAlert() {
    if (alertContainer) alertContainer.innerHTML = '';
  }

  /**
   * Simple HTML escaping helper to prevent XSS
   */
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
