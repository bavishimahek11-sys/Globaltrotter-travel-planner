/**
 * GlobalTrotter - Create Trip & Smart Stop Suggestions JS (Phase 7 Final Clean Architecture)
 * Communicates with backend REST API for route stops lookups and trip creation.
 *
 * NOTE: Strictly no fake data arrays, no fake users, and no localStorage database usage.
 */

document.addEventListener('DOMContentLoaded', () => {
  const tripTitleInput = document.getElementById('tripTitle');
  const fromCitySelect = document.getElementById('fromCity');
  const toCitySelect = document.getElementById('toCity');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const tripBudgetInput = document.getElementById('tripBudget');
  const findStopsBtn = document.getElementById('findStopsBtn');
  const saveTripBtn = document.getElementById('saveTripBtn');
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  const smartStopsSection = document.getElementById('smartStopsSection');
  const alertContainer = document.getElementById('alertContainer');
  const timelineOrigin = document.getElementById('timelineOrigin');
  const timelineDestination = document.getElementById('timelineDestination');
  const timelineStopsList = document.getElementById('timelineStopsList');
  const timelineEmpty = document.getElementById('timelineEmpty');
  const activeRouteBadge = document.getElementById('activeRouteBadge');

  // In-memory active state for current trip creation session
  let selectedStops = [];

  // Event Listeners
  if (findStopsBtn) {
    findStopsBtn.addEventListener('click', handleFindStops);
  }

  if (saveTripBtn) {
    saveTripBtn.addEventListener('click', handleSaveTrip);
  }

  if (fromCitySelect && toCitySelect) {
    fromCitySelect.addEventListener('change', () => {
      updateTimelineUI();
    });

    toCitySelect.addEventListener('change', () => {
      updateTimelineUI();
    });
  }

  // Quick route chips
  const routeChips = document.querySelectorAll('.route-chip');
  routeChips.forEach(chip => {
    chip.addEventListener('click', () => {
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
   * Main search handler - calls backend API
   */
  async function handleFindStops() {
    const fromCity = fromCitySelect ? fromCitySelect.value.trim() : '';
    const toCity = toCitySelect ? toCitySelect.value.trim() : '';

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

    updateTimelineUI();

    if (smartStopsSection) {
      smartStopsSection.style.display = 'block';
    }

    if (activeRouteBadge) {
      activeRouteBadge.textContent = `${fromCity} ➔ ${toCity}`;
    }

    // Show Loading State
    showLoadingState(fromCity, toCity);

    try {
      // Call real backend API
      const stops = await API.getSmartStops(fromCity, toCity);
      renderSuggestions(stops, fromCity, toCity);
    } catch (err) {
      console.warn('Smart stops lookup notice:', err.message);
      renderErrorState(fromCity, toCity);
    }
  }

  /**
   * Save trip button handler - sends real payload to backend API
   */
  async function handleSaveTrip() {
    const fromCity = fromCitySelect ? fromCitySelect.value.trim() : '';
    const toCity = toCitySelect ? toCitySelect.value.trim() : '';
    const title = tripTitleInput && tripTitleInput.value.trim() ? tripTitleInput.value.trim() : `Trip from ${fromCity} to ${toCity}`;
    const startDate = startDateInput ? startDateInput.value : '';
    const endDate = endDateInput ? endDateInput.value : '';
    const budgetVal = tripBudgetInput && tripBudgetInput.value ? parseFloat(tripBudgetInput.value) : null;

    if (!fromCity || !toCity) {
      showAlert('Please choose both From and To cities before saving your trip.', 'warning');
      return;
    }

    let duration = 'Flexible';
    if (startDate && endDate) {
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      const diffTime = d2 - d1;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0) {
        duration = `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
      }
    }

    const payload = {
      title,
      destination: toCity,
      fromCity,
      toCity,
      startDate,
      endDate,
      budget: budgetVal,
      duration,
      addedStops: selectedStops
    };

    if (saveTripBtn) {
      saveTripBtn.disabled = true;
      saveTripBtn.innerHTML = '<span>⏳</span> Saving Trip...';
    }

    try {
      const createdTrip = await API.createTrip(payload);
      const targetId = createdTrip && createdTrip.id ? createdTrip.id : '';
      if (targetId) {
        window.location.href = `itinerary.html?id=${encodeURIComponent(targetId)}`;
      } else {
        window.location.href = 'trips.html';
      }
    } catch (err) {
      showAlert('Unable to save trip to the backend. Please verify your connection and try again.', 'danger');
      if (saveTripBtn) {
        saveTripBtn.disabled = false;
        saveTripBtn.innerHTML = '<span>💾</span> Save Trip & View Itinerary';
      }
    }
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
        <div class="state-desc">Discovering intermediate destinations between <strong>${escapeHtml(from)}</strong> and <strong>${escapeHtml(to)}</strong></div>
      </div>
    `;
  }

  /**
   * Displays API error state UI with retry button
   */
  function renderErrorState(from, to) {
    if (!suggestionsContainer) return;
    suggestionsContainer.innerHTML = `
      <div class="state-box">
        <span class="state-icon">⚠️</span>
        <div class="state-title">Unable to load smart stop suggestions</div>
        <div class="state-desc">Could not connect to the smart stops service for route <strong>${escapeHtml(from)} ➔ ${escapeHtml(to)}</strong>. Please check your backend connection.</div>
        <div style="margin-top: 1rem;">
          <button type="button" id="retryStopsBtn" class="btn btn-sm btn-outline">
            <span>🔄</span> Retry Search
          </button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById('retryStopsBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', handleFindStops);
    }
  }

  /**
   * Renders suggestion cards or empty state
   */
  function renderSuggestions(stops, from, to) {
    if (!suggestionsContainer) return;

    if (!stops || !Array.isArray(stops) || stops.length === 0) {
      suggestionsContainer.innerHTML = `
        <div class="state-box">
          <span class="state-icon">🗺️</span>
          <div class="state-title">No smart stops found for this route</div>
          <div class="state-desc">No intermediate destinations were returned between <strong>${escapeHtml(from)}</strong> and <strong>${escapeHtml(to)}</strong>.</div>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'suggestions-grid';

    stops.forEach((stop, index) => {
      const isAdded = selectedStops.some(s => s.city.toLowerCase() === stop.city.toLowerCase());
      const card = document.createElement('div');
      card.className = `stop-card ${isAdded ? 'is-selected' : ''}`;
      card.id = `stop-card-${index}`;

      card.innerHTML = `
        <div>
          <div class="stop-header">
            <h3 class="stop-title">📍 ${escapeHtml(stop.city)}</h3>
          </div>
          <span class="stop-tag">${escapeHtml(stop.category || 'Stop')}</span>
          ${stop.duration ? `
            <div class="stop-duration">
              <span>⏱</span> Suggested stop: <strong>${escapeHtml(stop.duration)}</strong>
            </div>
          ` : ''}
          <p class="stop-desc">${escapeHtml(stop.description || '')}</p>
        </div>
        <div class="stop-footer">
          <button type="button" class="btn btn-add ${isAdded ? 'is-added' : ''}" data-city="${escapeHtml(stop.city)}">
            ${isAdded ? '✓ Added to Trip' : '+ Add to Trip'}
          </button>
        </div>
      `;

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
    const existsIndex = selectedStops.findIndex(s => s.city.toLowerCase() === stop.city.toLowerCase());

    if (existsIndex >= 0) {
      selectedStops.splice(existsIndex, 1);
      btn.classList.remove('is-added');
      btn.textContent = '+ Add to Trip';
      card.classList.remove('is-selected');
    } else {
      selectedStops.push(stop);
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
    const fromCity = fromCitySelect ? fromCitySelect.value.trim() : '';
    const toCity = toCitySelect ? toCitySelect.value.trim() : '';

    if (!timelineOrigin || !timelineDestination || !timelineStopsList) return;

    if (!fromCity && !toCity && selectedStops.length === 0) {
      if (timelineEmpty) timelineEmpty.style.display = 'block';
      if (timelineOrigin) timelineOrigin.style.display = 'none';
      if (timelineDestination) timelineDestination.style.display = 'none';
      if (timelineStopsList) timelineStopsList.innerHTML = '';
      return;
    }

    if (timelineEmpty) timelineEmpty.style.display = 'none';

    // Origin
    if (fromCity) {
      timelineOrigin.style.display = 'block';
      const nameEl = timelineOrigin.querySelector('.timeline-name');
      if (nameEl) nameEl.textContent = fromCity;
    } else {
      timelineOrigin.style.display = 'none';
    }

    // Intermediate stops
    timelineStopsList.innerHTML = '';
    if (selectedStops.length > 0) {
      selectedStops.forEach((stop, idx) => {
        const li = document.createElement('li');
        li.className = 'timeline-item';
        li.innerHTML = `
          <div class="timeline-dot stop"></div>
          <div class="timeline-content">
            <div>
              <div class="timeline-name">📍 ${escapeHtml(stop.city)}</div>
              <div class="timeline-type">${escapeHtml(stop.category || 'Stop')}${stop.duration ? ` • ${escapeHtml(stop.duration)}` : ''}</div>
            </div>
            <button type="button" class="btn-remove-stop" title="Remove stop" data-city="${escapeHtml(stop.city)}">✕</button>
          </div>
        `;

        const removeBtn = li.querySelector('.btn-remove-stop');
        removeBtn.addEventListener('click', () => {
          selectedStops = selectedStops.filter(s => s.city.toLowerCase() !== stop.city.toLowerCase());
          updateTimelineUI();
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
    if (toCity) {
      timelineDestination.style.display = 'block';
      const nameEl = timelineDestination.querySelector('.timeline-name');
      if (nameEl) nameEl.textContent = toCity;
    } else {
      timelineDestination.style.display = 'none';
    }
  }

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
