/**
 * GlobalTrotter - Trip Details, Itinerary, Budget & Interactive Map JS (Phases 3, 4 & 5)
 *
 * Manages rendering of dynamic trip details, grouped day-by-day activities,
 * activity creation/editing/deletion, dynamic budget calculations, expense tracking,
 * visual progress indicators, and interactive Leaflet map with route visualization.
 *
 * NOTE: Strictly no fake users, no fake trips, no fake locations, and no hardcoded fake coordinates.
 *
 * ============================================================================
 * EXPECTED BACKEND REST API SPECIFICATION (For Future Backend Integration)
 * ============================================================================
 * 
 * 1. Get Trip Details with Itinerary, Coordinates & Expenses:
 *    GET /api/trips/:id
 *    Response: {
 *      id: "trip_123",
 *      title: "Mumbai Coastal Getaway",
 *      destination: "Mumbai",
 *      fromCity: "Ahmedabad",
 *      toCity: "Mumbai",
 *      startDate: "2026-09-10",
 *      endDate: "2026-09-14",
 *      budget: 20000,
 *      duration: "5 days",
 *      addedStops: [
 *        { city: "Vadodara", category: "Heritage • Food", duration: "4–6 hours", latitude: 22.3072, longitude: 73.1812 }
 *      ],
 *      itinerary: [
 *        { 
 *          id: "act_1", 
 *          date: "2026-09-10", 
 *          time: "09:00", 
 *          activity: "Laxmi Vilas Palace", 
 *          location: "Vadodara", 
 *          latitude: 22.2937, 
 *          longitude: 73.1915, 
 *          notes: "Audio guide tour" 
 *        }
 *      ],
 *      expenses: [
 *        { id: "exp_1", title: "Train Tickets", category: "Transport", amount: 2500, date: "2026-09-10", notes: "Express coach" }
 *      ]
 *    }
 *
 * 2. Itinerary Endpoints (with Coordinates):
 *    POST /api/trips/:id/itinerary -> Add activity (Body: { date, time, activity, location, latitude, longitude, notes })
 *    PUT /api/trips/:id/itinerary/:activityId -> Update activity
 *    DELETE /api/trips/:id/itinerary/:activityId -> Delete activity
 *
 * 3. Expense Management Endpoints:
 *    GET /api/trips/:id/expenses -> List expenses for trip
 *    POST /api/trips/:id/expenses -> Add expense (Body: { title, category, amount, date, notes })
 *    PUT /api/trips/:id/expenses/:expenseId -> Update expense (Body: { title, category, amount, date, notes })
 *    DELETE /api/trips/:id/expenses/:expenseId -> Delete expense
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tripSummaryCard = document.getElementById('tripSummaryCard');
  const itineraryDaysContainer = document.getElementById('itineraryDaysContainer');
  const budgetSummaryBox = document.getElementById('budgetSummaryBox');
  const categoryBreakdownCard = document.getElementById('categoryBreakdownCard');
  const categoriesList = document.getElementById('categoriesList');
  const expensesContainer = document.getElementById('expensesContainer');
  const pageHeroTitle = document.getElementById('pageHeroTitle');
  const pageAlertContainer = document.getElementById('pageAlertContainer');

  // Map Elements (Phase 5)
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

  // Target Trip
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get('id') || 'active';
  let currentTrip = Storage.getTripById(tripId);

  // Initialize Page
  renderTripDetails();
  initTripMap();
  renderItinerary();
  renderBudgetAndExpenses();
  renderTripMap();
  setupEventListeners();

  // ==========================================================================
  // 1. RENDER TRIP DETAILS SUMMARY
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
      if (openAddExpenseBtn) openAddExpenseBtn.style.display = 'none';
      return;
    }

    if (openAddActivityBtn) openAddActivityBtn.style.display = 'inline-flex';
    if (openAddExpenseBtn) openAddExpenseBtn.style.display = 'inline-flex';

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

  // ==========================================================================
  // 2. PHASE 5: INTERACTIVE MAP & ROUTE VISUALIZATION (LEAFLET.JS)
  // ==========================================================================
  function initTripMap() {
    if (!tripMapEl || typeof L === 'undefined') return;

    try {
      if (!leafletMap) {
        leafletMap = L.map('tripMap', {
          zoomControl: true,
          scrollWheelZoom: false
        }).setView([20.5937, 78.9629], 5); // Default view over India

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
    if (!leafletMap || !markersLayer) return;

    markersLayer.clearLayers();
    activityMarkersMap = {};

    currentTrip = Storage.getTripById(tripId);
    if (!currentTrip) return;

    const activities = currentTrip.itinerary || [];
    const validPoints = [];

    // Extract valid coordinates from itinerary items
    activities.forEach((item, index) => {
      const lat = parseFloat(item.latitude || item.lat);
      const lng = parseFloat(item.longitude || item.lng);

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
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

        // Create Leaflet Marker
        const marker = L.marker([lat, lng]).addTo(markersLayer);
        
        // Popup Content
        const popupContent = `
          <div class="map-popup-card">
            <div class="map-popup-title">#${index + 1} ${escapeHtml(pointData.title)}</div>
            <div class="map-popup-meta">📍 ${escapeHtml(pointData.location)} ${pointData.time ? `• ⏰ ${formatTime(pointData.time)}` : ''}</div>
            ${pointData.notes ? `<div class="map-popup-notes">${escapeHtml(pointData.notes)}</div>` : ''}
          </div>
        `;
        marker.bindPopup(popupContent);

        // Marker Click Listener -> Focus / Highlight corresponding Itinerary Card
        marker.on('click', () => {
          highlightItineraryCard(item.id);
        });

        activityMarkersMap[item.id] = marker;
      }
    });

    // Draw sequenced route path if 2 or more coordinates exist
    if (validPoints.length >= 2) {
      const latLngs = validPoints.map(p => [p.lat, p.lng]);
      L.polyline(latLngs, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.85,
        dashArray: '6, 8'
      }).addTo(markersLayer);
    }

    // Update Map Bounds & Empty State Handling
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
      if (mapEmptyState) mapEmptyState.style.display = 'block';
      if (mapPointsBadge) mapPointsBadge.textContent = '0 locations plotted';
    }

    // Trigger map invalidation for proper rendering
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
  // 3. RENDER ITINERARY ACTIVITIES (GROUPED BY DAY / DATE)
  // ==========================================================================
  function renderItinerary() {
    if (!itineraryDaysContainer) return;

    currentTrip = Storage.getTripById(tripId);

    if (!currentTrip || (!currentTrip.fromCity && !currentTrip.toCity && !currentTrip.title)) {
      itineraryDaysContainer.innerHTML = '';
      return;
    }

    const activities = currentTrip.itinerary || [];

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

    // Attach Event Listeners to Activity Cards (Focus Map on Card Click)
    itineraryDaysContainer.querySelectorAll('.activity-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-icon')) return; // Ignore when clicking edit/delete
        const actId = card.getAttribute('data-id');
        highlightItineraryCard(actId);
        focusMapOnActivity(actId);
      });
    });

    // Attach Event Listeners to Edit and Delete Buttons
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

  // ==========================================================================
  // 4. RENDER BUDGET TRACKING & EXPENSES (PHASE 4)
  // ==========================================================================
  function renderBudgetAndExpenses() {
    if (!budgetSummaryBox || !expensesContainer) return;

    currentTrip = Storage.getTripById(tripId);

    if (!currentTrip || (!currentTrip.fromCity && !currentTrip.toCity && !currentTrip.title)) {
      budgetSummaryBox.innerHTML = '';
      expensesContainer.innerHTML = '';
      if (categoryBreakdownCard) categoryBreakdownCard.style.display = 'none';
      return;
    }

    const totalBudget = Number(currentTrip.budget) || 0;
    const expenses = currentTrip.expenses || [];
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    const remainingBudget = totalBudget > 0 ? (totalBudget - totalExpenses) : 0;
    const percentageUsed = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;
    const isExceeded = totalBudget > 0 && totalExpenses > totalBudget;
    const exceededAmount = isExceeded ? (totalExpenses - totalBudget) : 0;

    // A. Render Budget Summary Box
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

    // B. Render Category Breakdown
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

    // C. Render Expenses List
    if (expenses.length === 0) {
      expensesContainer.innerHTML = `
        <div class="state-box" style="padding: 2.5rem 1.5rem;">
          <span class="state-icon">💸</span>
          <div class="state-title">No expenses recorded yet.</div>
          <div class="state-desc">Keep track of your travel spending by logging transport, hotel, food, and activity costs.</div>
          <button type="button" class="btn btn-primary btn-add-first-expense">
            <span>+</span> Add Expense
          </button>
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
            <div class="activity-actions">
              <button type="button" class="btn-icon btn-edit-expense" data-id="${escapeHtml(item.id)}" title="Edit expense">
                <span>✏️</span> Edit
              </button>
              <button type="button" class="btn-icon btn-icon-danger btn-delete-expense" data-id="${escapeHtml(item.id)}" title="Delete expense">
                <span>🗑️</span> Delete
              </button>
            </div>
          </div>
        </div>
      `;
    });
    expHtml += '</div>';

    expensesContainer.innerHTML = expHtml;

    // Attach Event Listeners to Expense Edit & Delete Buttons
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

  // ==========================================================================
  // 5. EVENT LISTENERS SETUP
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

    // Global Key Listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (activityModal && activityModal.classList.contains('is-open')) closeModal();
        if (expenseModal && expenseModal.classList.contains('is-open')) closeExpenseModal();
      }
    });
  }

  // ==========================================================================
  // 6. ACTIVITY MODAL LOGIC (WITH COORDINATES SUPPORT)
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

  function handleActivityFormSubmit(e) {
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

    if (currentTrip && currentTrip.startDate && currentTrip.endDate) {
      if (date < currentTrip.startDate || date > currentTrip.endDate) {
        showModalAlert(`Note: Selected date (${formatDate(date)}) is outside your scheduled trip range (${formatDate(currentTrip.startDate)} – ${formatDate(currentTrip.endDate)}).`, 'warning');
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

    if (editingId) {
      Storage.updateItineraryItem(currentTrip.id, editingId, activityData);
      showPageAlert(`Activity "${name}" updated successfully!`, 'success');
    } else {
      Storage.addItineraryItem(currentTrip.id, activityData);
      showPageAlert(`Activity "${name}" added to itinerary!`, 'success');
    }

    closeModal();
    renderItinerary();
    renderTripMap();
  }

  function handleDeleteActivity(activityId) {
    if (!currentTrip) return;
    const activity = (currentTrip.itinerary || []).find(i => String(i.id) === String(activityId));
    const activityName = activity ? `"${activity.activity}"` : 'this activity';

    if (window.confirm(`Are you sure you want to delete ${activityName} from your itinerary?`)) {
      Storage.deleteItineraryItem(currentTrip.id, activityId);
      showPageAlert('Activity deleted successfully.', 'warning');
      renderItinerary();
      renderTripMap();
    }
  }

  // ==========================================================================
  // 7. EXPENSE MODAL LOGIC
  // ==========================================================================
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

  function handleExpenseFormSubmit(e) {
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

    if (editingId) {
      Storage.updateExpense(currentTrip.id, editingId, expenseData);
      showPageAlert(`Expense "${title}" updated successfully!`, 'success');
    } else {
      Storage.addExpense(currentTrip.id, expenseData);
      showPageAlert(`Expense "${title}" (₹${amountVal.toLocaleString()}) recorded!`, 'success');
    }

    closeExpenseModal();
    renderBudgetAndExpenses();
  }

  function handleDeleteExpense(expenseId) {
    if (!currentTrip) return;
    const expense = (currentTrip.expenses || []).find(e => String(e.id) === String(expenseId));
    const expenseTitle = expense ? `"${expense.title}"` : 'this expense';

    if (window.confirm(`Are you sure you want to delete ${expenseTitle}?`)) {
      Storage.deleteExpense(currentTrip.id, expenseId);
      showPageAlert('Expense deleted successfully.', 'warning');
      renderBudgetAndExpenses();
    }
  }

  // ==========================================================================
  // 8. HELPER FUNCTIONS
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
