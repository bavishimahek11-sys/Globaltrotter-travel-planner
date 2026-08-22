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

// Destination Photography Mapping for Visual Polish
const DESTINATION_IMAGES = {
  'mumbai': 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=800&q=80',
  'goa': 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80',
  'jaipur': 'assets/images/jaipur.jpg',
  'ahmedabad': 'assets/images/sabarmati_riverfront.jpg',
  'sabarmati': 'assets/images/sabarmati_riverfront.jpg',
  'delhi': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=800&q=80',
  'bangalore': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=800&q=80',
  'bengaluru': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=800&q=80',
  'pune': 'https://images.unsplash.com/photo-1618083840940-27a3c333068e?auto=format&fit=crop&w=800&q=80',
  'chennai': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80',
  'agra': 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
  'udaipur': 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=800&q=80',
  'vadodara': 'https://images.unsplash.com/photo-1599824619458-45213500962a?auto=format&fit=crop&w=800&q=80',
  'surat': 'https://images.unsplash.com/photo-1599824619458-45213500962a?auto=format&fit=crop&w=800&q=80',
  'lonavala': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  'default': 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80'
};

function getDestinationImage(name) {
  if (!name) return DESTINATION_IMAGES['default'];
  const lower = String(name).toLowerCase();
  for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
    if (key !== 'default' && lower.includes(key)) {
      return url;
    }
  }
  return DESTINATION_IMAGES['default'];
}

window.getDestinationImage = getDestinationImage;
