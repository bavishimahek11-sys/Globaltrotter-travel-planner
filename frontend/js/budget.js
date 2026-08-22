/**
 * GlobalTrotter - Dedicated Budget & Expense Tracker JS (Phase 7 Clean Architecture)
 * Fully connected to API client with clean loading, empty, and error retry states.
 *
 * NOTE: Strictly no fake expenses, fake trips, or localStorage database logic.
 */

document.addEventListener('DOMContentLoaded', () => {
  const budgetHeroTitle = document.getElementById('budgetHeroTitle');
  const budgetTripSubtitle = document.getElementById('budgetTripSubtitle');
  const budgetMetricsContainer = document.getElementById('budgetMetricsContainer');
  const budgetCategoryBreakdownContainer = document.getElementById('budgetCategoryBreakdownContainer');
  const budgetCategoriesList = document.getElementById('budgetCategoriesList');
  const budgetExpensesListContainer = document.getElementById('budgetExpensesListContainer');
  const budgetPageAlertContainer = document.getElementById('budgetPageAlertContainer');

  // Modal elements
  const budgetExpenseModal = document.getElementById('budgetExpenseModal');
  const budgetOpenAddExpenseBtn = document.getElementById('budgetOpenAddExpenseBtn');
  const budgetCloseModalBtn = document.getElementById('budgetCloseModalBtn');
  const budgetCancelModalBtn = document.getElementById('budgetCancelModalBtn');
  const budgetExpenseForm = document.getElementById('budgetExpenseForm');
  const budgetModalTitle = document.getElementById('budgetModalTitle');
  const budgetModalAlertContainer = document.getElementById('budgetModalAlertContainer');
  const budgetEditingExpenseId = document.getElementById('budgetEditingExpenseId');
  const bExpenseTitle = document.getElementById('bExpenseTitle');
  const bExpenseCategory = document.getElementById('bExpenseCategory');
  const bExpenseAmount = document.getElementById('bExpenseAmount');
  const bExpenseDate = document.getElementById('bExpenseDate');
  const bExpenseNotes = document.getElementById('bExpenseNotes');
  const budgetSaveExpenseSubmitBtn = document.getElementById('budgetSaveExpenseSubmitBtn');

  // Trip selection
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get('id');
  let currentTrip = null;

  setupBudgetListeners();
  loadBudgetData();

  async function loadBudgetData() {
    if (!tripId) {
      await renderTripSelector();
      return;
    }

    showLoading();

    try {
      currentTrip = await API.getTripById(tripId);
      if (!currentTrip) {
        await renderTripSelector();
        return;
      }
      renderBudgetPage();
    } catch (err) {
      console.warn('Budget data loading error:', err.message);
      renderErrorState();
    }
  }

  function showLoading() {
    if (budgetMetricsContainer) {
      budgetMetricsContainer.innerHTML = `
        <div class="state-box" style="padding: 3rem 1.5rem;">
          <div class="spinner"></div>
          <div class="state-title">Loading Budget Details...</div>
          <div class="state-desc">Fetching real-time budget metrics and expenses from database.</div>
        </div>
      `;
    }
  }

  function renderErrorState() {
    if (budgetMetricsContainer) {
      budgetMetricsContainer.innerHTML = `
        <div class="state-box" style="padding: 3rem 1.5rem;">
          <span class="state-icon">⚠️</span>
          <div class="state-title">Unable to Load Budget Data</div>
          <div class="state-desc">Could not connect to the backend server. Please verify your connection and try again.</div>
          <div style="margin-top: 1.25rem;">
            <button type="button" id="retryBudgetBtn" class="btn btn-primary btn-sm">
              <span>🔄</span> Retry
            </button>
          </div>
        </div>
      `;

      const retryBtn = document.getElementById('retryBudgetBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', loadBudgetData);
      }
    }
  }

  async function renderTripSelector() {
    if (budgetCategoryBreakdownContainer) budgetCategoryBreakdownContainer.style.display = 'none';
    if (budgetExpensesListContainer) budgetExpensesListContainer.innerHTML = '';
    if (budgetOpenAddExpenseBtn) budgetOpenAddExpenseBtn.style.display = 'none';
    if (budgetTripSubtitle) budgetTripSubtitle.textContent = 'Select one of your saved trips to view or manage its budget.';
    if (budgetHeroTitle) budgetHeroTitle.textContent = 'Trip Budget & Expense Tracker';

    if (!budgetMetricsContainer) return;

    budgetMetricsContainer.innerHTML = `
      <div class="state-box" style="padding: 3rem 1.5rem;">
        <div class="spinner"></div>
        <div class="state-title">Loading your trips...</div>
        <div class="state-desc">Fetching your saved travel plans from the database.</div>
      </div>
    `;

    try {
      const trips = await API.getTrips();
      if (!trips || !Array.isArray(trips) || trips.length === 0) {
        budgetMetricsContainer.innerHTML = `
          <div class="state-box" style="padding: 2.5rem 1.5rem;">
            <span class="state-icon">💸</span>
            <div class="state-title">No trips yet.</div>
            <div class="state-desc">Plan your first trip to start tracking your travel expenses and budget.</div>
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
        const budgetVal = t.budget ? `₹${Number(t.budget).toLocaleString()}` : 'Budget not set';

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
                <div>💰 <strong>Budget:</strong> ${budgetVal}</div>
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
              <a href="budget.html?id=${encodeURIComponent(t.id)}" class="btn btn-sm btn-primary" style="width: 100%;">
                <span>💰</span> View Budget ➔
              </a>
            </div>
          </div>
        `;
      });

      budgetMetricsContainer.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h2 class="section-title" style="margin-bottom: 0.25rem;"><span>💰</span> Select a Trip to View Budget</h2>
          <p class="section-subtitle">Choose a journey below to monitor expenses, calculate balances, and log transactions.</p>
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
      budgetMetricsContainer.innerHTML = `
        <div class="state-box" style="padding: 2.5rem 1.5rem;">
          <span class="state-icon">⚠️</span>
          <div class="state-title">Unable to load your trips.</div>
          <div class="state-desc">Could not connect to the backend server. Please verify your connection.</div>
          <div style="margin-top: 1.25rem;">
            <button type="button" id="retryBudgetSelectorBtn" class="btn btn-primary btn-sm">
              <span>🔄</span> Try again
            </button>
          </div>
        </div>
      `;
      const retryBtn = document.getElementById('retryBudgetSelectorBtn');
      if (retryBtn) retryBtn.addEventListener('click', renderTripSelector);
    }
  }

  function renderBudgetPage() {
    if (!currentTrip) return;

    if (budgetOpenAddExpenseBtn) budgetOpenAddExpenseBtn.style.display = 'inline-flex';

    const title = currentTrip.title || `Trip to ${currentTrip.toCity || 'Destination'}`;
    if (budgetHeroTitle) budgetHeroTitle.textContent = `${title} — Budget`;
    if (budgetTripSubtitle) {
      budgetTripSubtitle.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.25rem;">
          <span>📍 Route: <strong>${escapeHtml(currentTrip.fromCity || 'Origin')} ➔ ${escapeHtml(currentTrip.toCity || 'Destination')}</strong></span>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <a href="budget.html" class="btn btn-sm btn-outline"><span>←</span> Change Trip</a>
            <a href="itinerary.html?id=${encodeURIComponent(currentTrip.id)}" class="btn btn-sm btn-outline"><span>📋</span> View Itinerary</a>
            <a href="map.html?id=${encodeURIComponent(currentTrip.id)}" class="btn btn-sm btn-outline"><span>🗺️</span> View Map</a>
          </div>
        </div>
      `;
    }

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

    // 1. Render Metrics
    if (budgetMetricsContainer) {
      let noBudgetMessage = '';
      if (totalBudget === 0 && expenses.length === 0) {
        noBudgetMessage = `
          <div class="state-box" style="padding: 2rem 1rem; margin-bottom: 1.5rem;">
            <span class="state-icon">💸</span>
            <div class="state-title">No budget information is available for this trip.</div>
            <div class="state-desc">No budget or expense records have been recorded for this journey yet. Click "+ Add Expense" above to log your first travel expense.</div>
          </div>
        `;
      }

      budgetMetricsContainer.innerHTML = `
        ${noBudgetMessage}
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
            <div><strong>Budget exceeded!</strong> Your total spending is over budget by <strong>₹${exceededAmount.toLocaleString()}</strong>.</div>
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
            <div>Set a total trip budget to view remaining funds and progress metrics.</div>
          </div>
        `}
      `;
    }

    // 2. Render Category Breakdown
    if (expenses.length > 0 && budgetCategoryBreakdownContainer && budgetCategoriesList) {
      budgetCategoryBreakdownContainer.style.display = 'block';

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

      budgetCategoriesList.innerHTML = catHtml;
    } else if (budgetCategoryBreakdownContainer) {
      budgetCategoryBreakdownContainer.style.display = 'none';
    }

    // 3. Render Expenses List
    if (budgetExpensesListContainer) {
      if (expenses.length === 0) {
        budgetExpensesListContainer.innerHTML = `
          <div class="state-box" style="padding: 2.5rem 1.5rem;">
            <span class="state-icon">💸</span>
            <div class="state-title">No expenses recorded yet.</div>
            <div class="state-desc">Start adding expenses to monitor your trip budget.</div>
            <button type="button" class="btn btn-primary btn-add-first-bexpense">
              <span>+</span> Add Expense
            </button>
          </div>
        `;

        const addFirstBtn = budgetExpensesListContainer.querySelector('.btn-add-first-bexpense');
        if (addFirstBtn) {
          addFirstBtn.addEventListener('click', openBudgetAddModal);
        }
      } else {
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
                  <button type="button" class="btn-icon btn-edit-bexpense" data-id="${escapeHtml(item.id)}" title="Edit expense">
                    <span>✏️</span> Edit
                  </button>
                  <button type="button" class="btn-icon btn-icon-danger btn-delete-bexpense" data-id="${escapeHtml(item.id)}" title="Delete expense">
                    <span>🗑️</span> Delete
                  </button>
                </div>
              </div>
            </div>
          `;
        });
        expHtml += '</div>';
        budgetExpensesListContainer.innerHTML = expHtml;

        budgetExpensesListContainer.querySelectorAll('.btn-edit-bexpense').forEach(btn => {
          btn.addEventListener('click', () => {
            const expId = btn.getAttribute('data-id');
            openBudgetEditModal(expId);
          });
        });

        budgetExpensesListContainer.querySelectorAll('.btn-delete-bexpense').forEach(btn => {
          btn.addEventListener('click', () => {
            const expId = btn.getAttribute('data-id');
            handleBudgetDeleteExpense(expId);
          });
        });
      }
    }
  }

  function setupBudgetListeners() {
    if (budgetOpenAddExpenseBtn) budgetOpenAddExpenseBtn.addEventListener('click', openBudgetAddModal);
    if (budgetCloseModalBtn) budgetCloseModalBtn.addEventListener('click', closeBudgetModal);
    if (budgetCancelModalBtn) budgetCancelModalBtn.addEventListener('click', closeBudgetModal);

    if (budgetExpenseModal) {
      budgetExpenseModal.addEventListener('click', (e) => {
        if (e.target === budgetExpenseModal) closeBudgetModal();
      });
    }

    if (budgetExpenseForm) {
      budgetExpenseForm.addEventListener('submit', handleBudgetFormSubmit);
    }
  }

  function openBudgetAddModal() {
    if (!budgetExpenseModal || !budgetExpenseForm) return;
    clearBudgetModalAlerts();
    budgetExpenseForm.reset();
    budgetEditingExpenseId.value = '';
    budgetModalTitle.textContent = 'Add Trip Expense';
    if (budgetSaveExpenseSubmitBtn) budgetSaveExpenseSubmitBtn.innerHTML = '<span>💾</span> Save Expense';

    if (currentTrip && currentTrip.startDate && bExpenseDate) {
      bExpenseDate.value = currentTrip.startDate;
    } else if (bExpenseDate) {
      bExpenseDate.value = new Date().toISOString().split('T')[0];
    }

    budgetExpenseModal.classList.add('is-open');
    budgetExpenseModal.setAttribute('aria-hidden', 'false');
    if (bExpenseTitle) bExpenseTitle.focus();
  }

  function openBudgetEditModal(expenseId) {
    if (!budgetExpenseModal || !budgetExpenseForm || !currentTrip) return;
    const expense = (currentTrip.expenses || []).find(e => String(e.id) === String(expenseId));
    if (!expense) return;

    clearBudgetModalAlerts();
    budgetEditingExpenseId.value = expense.id;
    budgetModalTitle.textContent = 'Edit Expense Entry';
    if (budgetSaveExpenseSubmitBtn) budgetSaveExpenseSubmitBtn.innerHTML = '<span>💾</span> Update Expense';

    bExpenseTitle.value = expense.title || '';
    bExpenseCategory.value = expense.category || '';
    bExpenseAmount.value = expense.amount || '';
    bExpenseDate.value = expense.date || '';
    bExpenseNotes.value = expense.notes || '';

    budgetExpenseModal.classList.add('is-open');
    budgetExpenseModal.setAttribute('aria-hidden', 'false');
    if (bExpenseTitle) bExpenseTitle.focus();
  }

  function closeBudgetModal() {
    if (!budgetExpenseModal) return;
    budgetExpenseModal.classList.remove('is-open');
    budgetExpenseModal.setAttribute('aria-hidden', 'true');
    clearBudgetModalAlerts();
  }

  async function handleBudgetFormSubmit(e) {
    e.preventDefault();
    clearBudgetModalAlerts();

    const title = bExpenseTitle ? bExpenseTitle.value.trim() : '';
    const category = bExpenseCategory ? bExpenseCategory.value.trim() : '';
    const amountVal = bExpenseAmount ? parseFloat(bExpenseAmount.value) : 0;
    const date = bExpenseDate ? bExpenseDate.value.trim() : '';
    const notes = bExpenseNotes ? bExpenseNotes.value.trim() : '';
    const editingId = budgetEditingExpenseId ? budgetEditingExpenseId.value.trim() : '';

    if (!title) {
      showBudgetModalAlert('Expense title is required.');
      if (bExpenseTitle) bExpenseTitle.focus();
      return;
    }
    if (!category) {
      showBudgetModalAlert('Please select a category.');
      if (bExpenseCategory) bExpenseCategory.focus();
      return;
    }
    if (isNaN(amountVal) || amountVal <= 0) {
      showBudgetModalAlert('Amount must be a positive number greater than 0.');
      if (bExpenseAmount) bExpenseAmount.focus();
      return;
    }
    if (!date) {
      showBudgetModalAlert('Expense date is required.');
      if (bExpenseDate) bExpenseDate.focus();
      return;
    }

    const expenseData = { title, category, amount: amountVal, date, notes };

    if (budgetSaveExpenseSubmitBtn) {
      budgetSaveExpenseSubmitBtn.disabled = true;
      budgetSaveExpenseSubmitBtn.innerHTML = '<span>⏳</span> Saving...';
    }

    try {
      if (editingId) {
        await API.updateExpense(currentTrip.id, editingId, expenseData);
        showBudgetPageAlert(`Expense "${title}" updated successfully!`);
      } else {
        await API.addExpense(currentTrip.id, expenseData);
        showBudgetPageAlert(`Expense "${title}" recorded!`);
      }

      closeBudgetModal();
      loadBudgetData();
    } catch (err) {
      showBudgetModalAlert(err.message || 'Failed to save expense. Please try again.');
    } finally {
      if (budgetSaveExpenseSubmitBtn) {
        budgetSaveExpenseSubmitBtn.disabled = false;
        budgetSaveExpenseSubmitBtn.innerHTML = editingId ? '<span>💾</span> Update Expense' : '<span>💾</span> Save Expense';
      }
    }
  }

  async function handleBudgetDeleteExpense(expenseId) {
    if (!currentTrip) return;
    const expense = (currentTrip.expenses || []).find(e => String(e.id) === String(expenseId));
    const expenseTitle = expense ? `"${expense.title}"` : 'this expense';

    if (window.confirm(`Are you sure you want to delete ${expenseTitle}?`)) {
      try {
        await API.deleteExpense(currentTrip.id, expenseId);
        showBudgetPageAlert('Expense deleted successfully.', 'warning');
        loadBudgetData();
      } catch (err) {
        showBudgetPageAlert('Failed to delete expense. Please try again.', 'danger');
      }
    }
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

  function showBudgetModalAlert(message, type = 'danger') {
    if (!budgetModalAlertContainer) return;
    budgetModalAlertContainer.innerHTML = `
      <div class="alert alert-${type}">
        <span>⚠️</span>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
  }

  function clearBudgetModalAlerts() {
    if (budgetModalAlertContainer) budgetModalAlertContainer.innerHTML = '';
  }

  function showBudgetPageAlert(message, type = 'success') {
    if (!budgetPageAlertContainer) return;
    budgetPageAlertContainer.innerHTML = `
      <div class="alert alert-${type}" style="margin-bottom: 1.5rem;">
        <span>✓</span>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
    setTimeout(() => {
      if (budgetPageAlertContainer) budgetPageAlertContainer.innerHTML = '';
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
