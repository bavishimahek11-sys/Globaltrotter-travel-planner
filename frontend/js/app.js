/**
 * GlobalTrotter - Common Application JS
 * Handles navigation toggles, global interactions, and authentication state in the navbar.
 * Strictly no fake users or mock authentication data.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Toggle
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('is-open');
    });
  }

  // Update Navbar Auth State
  updateNavbarAuth();
  checkPageAuthProtection();
});

function updateNavbarAuth() {
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  const user = typeof API !== 'undefined' && API.getCurrentUser ? API.getCurrentUser() : null;
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  if (user && user.id) {
    // User is logged in
    const userLi = document.createElement('li');
    userLi.className = 'nav-auth-item';
    userLi.style.display = 'flex';
    userLi.style.alignItems = 'center';
    userLi.style.gap = '0.75rem';

    userLi.innerHTML = `
      <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); background: var(--bg-surface-alt); padding: 0.35rem 0.75rem; border-radius: var(--radius-full); border: 1px solid var(--border-color);">
        👤 ${escapeHtml(user.name || user.email)}
      </span>
      <button type="button" id="globalLogoutBtn" class="btn btn-sm btn-outline" style="padding: 0.35rem 0.75rem;">
        Logout
      </button>
    `;

    // Remove any existing login/register items if present
    const existingAuthLinks = navLinks.querySelectorAll('a[href="login.html"], a[href="register.html"]');
    existingAuthLinks.forEach(a => {
      const li = a.closest('li');
      if (li) li.remove();
    });

    const oldAuthItem = navLinks.querySelector('.nav-auth-item');
    if (oldAuthItem) oldAuthItem.remove();

    navLinks.appendChild(userLi);

    const logoutBtn = document.getElementById('globalLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to log out?')) {
          API.logout();
        }
      });
    }
  } else {
    // User is logged out
    const oldAuthItem = navLinks.querySelector('.nav-auth-item');
    if (oldAuthItem) oldAuthItem.remove();

    // Check if login/register are already in nav
    const hasLogin = navLinks.querySelector('a[href="login.html"]');
    if (!hasLogin && currentPath !== 'login.html' && currentPath !== 'register.html') {
      const authLi = document.createElement('li');
      authLi.className = 'nav-auth-item';
      authLi.innerHTML = `
        <a href="login.html" class="btn btn-sm btn-primary">Login / Register</a>
      `;
      navLinks.appendChild(authLi);
    }
  }
}

function checkPageAuthProtection() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const protectedPages = ['create-trip.html', 'trips.html'];
  const user = typeof API !== 'undefined' && API.getCurrentUser ? API.getCurrentUser() : null;

  if (protectedPages.includes(currentPath)) {
    if (!user || !user.id) {
      window.location.href = `login.html?redirect=${encodeURIComponent(currentPath)}`;
    }
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
