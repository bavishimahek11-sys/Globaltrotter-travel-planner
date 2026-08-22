/**
 * GlobalTrotter - Budget JS
 * Calculates simple prototype estimates based on active stops.
 * Strictly no fake users.
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('budgetContent');
  if (!container) return;

  const trip = Storage.getActiveTrip();
  const stopsCount = trip.addedStops ? trip.addedStops.length : 0;

  if (!trip.fromCity && !trip.toCity) {
    container.innerHTML = `
      <div class="state-box">
        <span class="state-icon">💸</span>
        <div class="state-title">No Active Trip</div>
        <div class="state-desc">Select a route in the trip planner to see an estimated budget breakdown.</div>
        <div style="margin-top: 1.5rem;">
          <a href="create-trip.html" class="btn btn-primary">Plan a Trip</a>
        </div>
      </div>
    `;
    return;
  }

  const baseTravel = 1500;
  const stopCost = stopsCount * 800;
  const total = baseTravel + stopCost;

  container.innerHTML = `
    <div style="background: var(--bg-surface-alt); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span>Route: <strong>${trip.fromCity} ➔ ${trip.toCity}</strong></span>
        <span>Base Travel: ₹${baseTravel.toLocaleString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span>Intermediate Stops (${stopsCount}):</span>
        <span>₹${stopCost.toLocaleString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-top: 0.75rem; border-top: 1px solid var(--border-color); font-size: 1.15rem; font-weight: 700; color: var(--primary);">
        <span>Estimated Total:</span>
        <span>₹${total.toLocaleString()}</span>
      </div>
    </div>
  `;
});
