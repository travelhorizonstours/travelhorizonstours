// ==================== CONFIG ====================
// Your Apps Script Web App URL (from Deploy > Manage deployments)
var API_BASE = 'https://script.google.com/macros/s/AKfycbwYeRKY9i5XMMsubu9NpBvrk6Lrzx89ZGu2x8JMQZoYUNVcN1aY9vHt9Awjxp791CoL/exec';

// Which sheet backs which page's listing grid
var PAGE_SHEET_MAP = {
  'tours.html': 'Tours',
  'accommodation.html': 'Accommodation',
  'transport.html': 'Transport',
  'car-hire.html': 'CarHire',
  'deals.html': 'Deals'
};

// Map a sheet's "category"/"badge" text to the filter-chip slugs already in the HTML
var CATEGORY_SLUGS = {
  'Wildlife Safaris': 'wildlife',
  'Culture & Heritage': 'culture',
  'Beach & Coast': 'beach',
  'Adventure & Hiking': 'adventure',
  'Balloon Safaris': 'balloon',
  'Economy': 'economy',
  'SUV & 4x4': 'suv',
  'Safari Vehicle': 'safari',
  'Vans & Minibus': 'van',
  'Luxury': 'luxury',
  'Chauffeur Service': 'luxury',
  'Corporate Fleet': 'luxury'
};

document.addEventListener('DOMContentLoaded', function () {
  // Header: transparent over the hero image at the top of the page,
  // solid once the visitor scrolls past it. No blur — just a color swap.
  var header = document.querySelector('.site-header');
  if (header) {
    var SCROLL_THRESHOLD = 40;
    var setScrolledState = function () {
      if (window.scrollY > SCROLL_THRESHOLD) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    setScrolledState();
    window.addEventListener('scroll', setScrolledState, { passive: true });
  }

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Search tabs: switch active state and adjust field labels per category
  var tabs = document.querySelectorAll('.search-tab');
  var fieldConfig = {
    accommodation: [
      { label: 'Destination', placeholder: 'Where are you going?' },
      { label: 'Check-in', placeholder: 'Select date' },
      { label: 'Check-out', placeholder: 'Select date' },
      { label: 'Travellers', placeholder: '2 Adults' }
    ],
    carhire: [
      { label: 'Pickup location', placeholder: 'City or airport' },
      { label: 'Pickup date', placeholder: 'Select date' },
      { label: 'Return date', placeholder: 'Select date' },
      { label: 'Vehicle type', placeholder: 'Any vehicle' }
    ],
    tours: [
      { label: 'Activity or tour', placeholder: 'Safari, culture, adventure…' },
      { label: 'Start date', placeholder: 'Select date' },
      { label: 'Duration', placeholder: 'Any length' },
      { label: 'Travellers', placeholder: '2 Adults' }
    ],
    flights: [
      { label: 'Flying from', placeholder: 'Departure city' },
      { label: 'Departing', placeholder: 'Select date' },
      { label: 'Returning', placeholder: 'Select date' },
      { label: 'Passengers', placeholder: '1 Adult' }
    ],
    transport: [
      { label: 'Route', placeholder: 'From — to' },
      { label: 'Travel date', placeholder: 'Select date' },
      { label: 'Time', placeholder: 'Any time' },
      { label: 'Passengers', placeholder: '1 passenger' }
    ],
    more: [
      { label: 'What do you need?', placeholder: 'Event, wedding, group travel…' },
      { label: 'Date', placeholder: 'Select date' },
      { label: 'Location', placeholder: 'Where in Kenya?' },
      { label: 'Group size', placeholder: 'Number of people' }
    ]
  };

  var labels = document.querySelectorAll('.search-field label');
  var inputs = document.querySelectorAll('.search-field input, .search-field select');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var key = tab.getAttribute('data-key');
      var config = fieldConfig[key];
      if (!config) return;
      labels.forEach(function (label, i) {
        if (config[i]) label.textContent = config[i].label;
      });
      inputs.forEach(function (input, i) {
        if (config[i] && input.tagName === 'INPUT') {
          input.placeholder = config[i].placeholder;
        }
      });
    });
  });

  // Search submit: demo-only, no live search index wired up
  ['#search-form', '#car-search-form'].forEach(function (sel) {
    var form = document.querySelector(sel);
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        alert("This search isn't connected to a live availability index yet — browse the listings below and book directly.");
      });
    }
  });

  // Wire up the filter chips (works for both static and dynamically loaded cards)
  setupFilterChips();

  // Load live listings from the backend, then fall back to whatever is
  // already hardcoded in the HTML if the fetch fails for any reason.
  loadListingGrid();

  // Make any "Book"/"View"/"Enquire" buttons already in the page open the
  // booking modal (covers the case where the fetch hasn't finished yet,
  // or failed and we're using the static fallback cards).
  attachBookingHandlers();

  injectModalStyles();
});

// ==================== FILTER CHIPS ====================
function setupFilterChips() {
  var chips = document.querySelectorAll('.filter-chip');
  if (!chips.length) return;

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      var cat = chip.getAttribute('data-cat');
      // Re-query every click so this also works on cards rendered after fetch
      var tourCards = document.querySelectorAll('.tour-card');
      tourCards.forEach(function (card) {
        if (cat === 'all' || card.getAttribute('data-cat') === cat) {
          card.hidden = false;
        } else {
          card.hidden = true;
        }
      });
    });
  });
}

// ==================== LIVE LISTINGS ====================
function currentPageFile() {
  var path = location.pathname.split('/').pop();
  return path || 'index.html';
}

function loadListingGrid() {
  var sheetName = PAGE_SHEET_MAP[currentPageFile()];
  if (!sheetName) return; // this page has no listing grid (e.g. index.html)

  var grid = document.querySelector('.tours-grid');
  if (!grid) return;

  fetch(API_BASE + '?action=listing&sheet=' + encodeURIComponent(sheetName))
    .then(function (res) { return res.json(); })
    .then(function (items) {
      if (!items || !Array.isArray(items) || items.length === 0) {
        // Nothing in the sheet yet — keep the static cards already in the HTML
        return;
      }

      var isDeal = sheetName === 'Deals';
      var visible = items.filter(function (item) {
        return String(item.active).toUpperCase() !== 'FALSE';
      });

      grid.innerHTML = visible.map(function (item) {
        return buildCardHTML(item, isDeal);
      }).join('');

      attachBookingHandlers();

      // Re-apply whichever filter chip is currently active (default: "all")
      var activeChip = document.querySelector('.filter-chip.active');
      if (activeChip) activeChip.click();
    })
    .catch(function (err) {
      console.warn('Live listings unavailable, showing default content.', err);
    });
}

function slugifyCategory(category) {
  if (CATEGORY_SLUGS[category]) return CATEGORY_SLUGS[category];
  var first = (category || '').toLowerCase().split(/[\s&]+/)[0];
  return first || 'other';
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function pinSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/></svg>';
}
function clockSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
}
function starSvg() {
  return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.7 5.9 6.3.6-4.7 4.4 1.3 6.3L12 17l-5.6 3.2 1.3-6.3-4.7-4.4 6.3-.6Z"/></svg>';
}

function buildCardHTML(item, isDeal) {
  var badgeText = isDeal ? (item.badge || '') : (item.category || '');
  var slug = slugifyCategory(item.category || item.badge || '');
  var buttonLabel = /enquire/i.test(item.price || '') ? 'Enquire' : (isDeal ? 'View Deal' : 'Book');
  var title = escapeHtml(item.title);

  return (
    '<div class="tour-card" data-cat="' + slug + '">' +
      '<div class="thumb">' +
        '<img src="' + escapeHtml(item.image) + '" alt="' + title + '">' +
        '<span class="cat-badge">' + escapeHtml(badgeText) + '</span>' +
      '</div>' +
      '<div class="body">' +
        '<h3>' + title + '</h3>' +
        '<div class="meta">' +
          '<span>' + pinSvg() + escapeHtml(item.meta1) + '</span>' +
          '<span>' + clockSvg() + escapeHtml(item.meta2) + '</span>' +
        '</div>' +
        '<div class="rating">' + starSvg() + ' ' + escapeHtml(item.rating) + ' (' + escapeHtml(item.reviews) + ' reviews)</div>' +
        '<div class="price-row">' +
          '<span class="price">' + escapeHtml(item.price) + '<span>' + escapeHtml(item.priceNote) + '</span></span>' +
          '<a href="#" class="view-btn" data-book-title="' + title + '">' + buttonLabel + '</a>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ==================== BOOKING MODAL ====================
function attachBookingHandlers() {
  document.querySelectorAll('.view-btn').forEach(function (btn) {
    // Avoid double-binding if this button was already wired up
    if (btn.dataset.bookingBound) return;
    btn.dataset.bookingBound = 'true';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var card = btn.closest('.tour-card');
      var title = btn.getAttribute('data-book-title') ||
        (card && card.querySelector('h3') ? card.querySelector('h3').textContent : 'Enquiry');
      var sheetName = PAGE_SHEET_MAP[currentPageFile()] || 'Enquiry';
      openBookingModal(title, sheetName);
    });
  });
}

function openBookingModal(itemTitle, service) {
  closeBookingModal(); // ensure only one instance at a time

  var overlay = document.createElement('div');
  overlay.id = 'bh-booking-overlay';
  overlay.innerHTML =
    '<div id="bh-booking-modal" role="dialog" aria-modal="true">' +
      '<button type="button" id="bh-booking-close" aria-label="Close">&times;</button>' +
      '<h3>Book: ' + escapeHtml(itemTitle) + '</h3>' +
      '<form id="bh-booking-form">' +
        '<label>Full name<input type="text" name="name" required></label>' +
        '<label>Email<input type="email" name="email" required></label>' +
        '<label>Phone<input type="tel" name="phone" placeholder="07xx xxx xxx" required></label>' +
        '<label>Preferred date<input type="date" name="date"></label>' +
        '<label>Notes (optional)<textarea name="notes" rows="3"></textarea></label>' +
        '<div id="bh-booking-status" aria-live="polite"></div>' +
        '<div class="bh-booking-actions">' +
          '<button type="button" id="bh-booking-cancel">Cancel</button>' +
          '<button type="submit" id="bh-booking-submit">Send Booking Request</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  document.body.appendChild(overlay);

  document.getElementById('bh-booking-close').addEventListener('click', closeBookingModal);
  document.getElementById('bh-booking-cancel').addEventListener('click', closeBookingModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeBookingModal();
  });

  document.getElementById('bh-booking-form').addEventListener('submit', function (e) {
    e.preventDefault();
    submitBooking(e.target, itemTitle, service);
  });
}

function closeBookingModal() {
  var existing = document.getElementById('bh-booking-overlay');
  if (existing) existing.remove();
}

function submitBooking(form, itemTitle, service) {
  var statusEl = document.getElementById('bh-booking-status');
  var submitBtn = document.getElementById('bh-booking-submit');
  var data = new FormData(form);

  var payload = {
    action: 'book',
    service: service,
    itemTitle: itemTitle,
    name: data.get('name'),
    email: data.get('email'),
    phone: data.get('phone'),
    date: data.get('date'),
    notes: data.get('notes')
  };

  submitBtn.disabled = true;
  statusEl.textContent = 'Sending your request…';
  statusEl.className = '';

  // Content-Type text/plain avoids a CORS preflight that Apps Script can't handle
  fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      if (result && result.success) {
        statusEl.textContent = "Request received! We'll be in touch shortly to confirm.";
        statusEl.className = 'bh-status-success';
        setTimeout(closeBookingModal, 2200);
      } else {
        statusEl.textContent = 'Something went wrong — please try again or contact us directly.';
        statusEl.className = 'bh-status-error';
        submitBtn.disabled = false;
      }
    })
    .catch(function () {
      statusEl.textContent = 'Network error — please check your connection and try again.';
      statusEl.className = 'bh-status-error';
      submitBtn.disabled = false;
    });
}

function injectModalStyles() {
  if (document.getElementById('bh-booking-styles')) return;
  var style = document.createElement('style');
  style.id = 'bh-booking-styles';
  style.textContent =
    '#bh-booking-overlay{position:fixed;inset:0;background:rgba(20,33,61,0.55);display:flex;' +
    'align-items:center;justify-content:center;z-index:9999;padding:20px;}' +
    '#bh-booking-modal{background:#fff;border-radius:14px;max-width:440px;width:100%;' +
    'padding:28px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;}' +
    '#bh-booking-modal h3{margin:0 0 18px;color:var(--navy,#14213D);font-size:1.2rem;padding-right:24px;}' +
    '#bh-booking-close{position:absolute;top:14px;right:16px;background:none;border:none;' +
    'font-size:1.6rem;line-height:1;cursor:pointer;color:#888;}' +
    '#bh-booking-form label{display:block;margin-bottom:14px;font-size:0.9rem;color:#333;font-weight:600;}' +
    '#bh-booking-form input,#bh-booking-form textarea{display:block;width:100%;margin-top:6px;' +
    'padding:10px 12px;border:1px solid #d7dce3;border-radius:8px;font-size:0.95rem;font-family:inherit;' +
    'font-weight:400;box-sizing:border-box;}' +
    '.bh-booking-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:8px;}' +
    '#bh-booking-cancel{background:#eee;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:600;}' +
    '#bh-booking-submit{background:var(--gold-bright,#E5A93A);color:var(--navy,#14213D);border:none;' +
    'padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:700;}' +
    '#bh-booking-submit:disabled{opacity:0.6;cursor:not-allowed;}' +
    '#bh-booking-status{min-height:20px;font-size:0.88rem;margin-top:4px;}' +
    '.bh-status-success{color:#1a7f37;font-weight:600;}' +
    '.bh-status-error{color:#c0392b;font-weight:600;}';
  document.head.appendChild(style);
}

