// Wraps fetch with a timeout + one automatic retry, since Apps Script cold
// starts can occasionally stall or fail on the first attempt.
function fetchJsonWithRetry(url, options, timeoutMs) {
  timeoutMs = timeoutMs || 12000;

  function attempt() {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    var fetchOptions = Object.assign({}, options, { signal: controller.signal });

    return fetch(url, fetchOptions)
      .then(function (res) {
        clearTimeout(timer);
        return res.json();
      })
      .catch(function (err) {
        clearTimeout(timer);
        throw err;
      });
  }

  return attempt().catch(function () {
    return new Promise(function (resolve) { setTimeout(resolve, 500); })
      .then(attempt);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var shell = document.getElementById('staff-shell');
  var logoutBtn = document.getElementById('staff-logout');
  var refreshBtn = document.getElementById('refresh-bookings');
  var welcomeEl = document.getElementById('staff-welcome');

  function isLoggedIn() {
    return sessionStorage.getItem('bh_staff_logged_in') === 'true';
  }

  // No login form lives on this page anymore — that happens via the popup
  // on the public site. If someone lands here directly without a valid
  // session, send them back to the homepage instead of showing anything.
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  // Warm up the Apps Script backend right away so the first real data
  // request (bookings) comes back as quickly as possible.
  fetch(API_BASE + '?action=listing&sheet=Tours').catch(function () {});

  function showDashboard() {
    shell.classList.add('visible');
    var username = sessionStorage.getItem('bh_staff_username') || '';
    welcomeEl.textContent = username ? ('Signed in as ' + username) : '';
    loadBookings();
  }

  showDashboard();

  logoutBtn.addEventListener('click', function () {
    sessionStorage.removeItem('bh_staff_logged_in');
    sessionStorage.removeItem('bh_staff_username');
    window.location.href = 'index.html';
  });

  refreshBtn.addEventListener('click', function () {
    if (currentPanel === 'listings') {
      loadListings();
    } else {
      loadBookings();
    }
  });

  var topbarTitle = document.querySelector('.topbar-title');
  var currentPanel = 'dashboard';
  var PANEL_TITLES = {
    dashboard: 'Bookings Dashboard',
    bookings: 'Bookings Dashboard',
    listings: 'Manage Listings'
  };

  document.querySelectorAll('.sidebar-item[data-panel]').forEach(function (item) {
    item.addEventListener('click', function () {
      document.querySelectorAll('.sidebar-item[data-panel]').forEach(function (i) {
        i.classList.remove('active');
      });
      item.classList.add('active');

      var panelKey = item.getAttribute('data-panel');
      currentPanel = panelKey;
      topbarTitle.textContent = PANEL_TITLES[panelKey] || 'Dashboard';

      var targetPanelId = panelKey === 'listings' ? 'panel-listings' : 'panel-dashboard';
      document.querySelectorAll('.content-panel').forEach(function (p) {
        p.classList.toggle('active', p.id === targetPanelId);
      });

      if (panelKey === 'listings') {
        loadListings();
      } else {
        loadBookings();
      }
    });
  });

  function loadBookings() {
    var loading = document.getElementById('bookings-loading');
    var empty = document.getElementById('bookings-empty');
    var table = document.getElementById('bookings-table');
    var tbody = document.getElementById('bookings-tbody');

    loading.textContent = 'Loading bookings… (first load can take a few seconds)';
    loading.style.display = 'block';
    empty.style.display = 'none';
    table.style.display = 'none';

    fetchJsonWithRetry(API_BASE + '?action=bookings')
      .then(function (bookings) {
        loading.style.display = 'none';
        updateStats(bookings || []);

        if (!bookings || !bookings.length) {
          empty.style.display = 'block';
          return;
        }

        bookings.sort(function (a, b) {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });

        tbody.innerHTML = bookings.map(rowHtml).join('');
        table.style.display = 'table';

        tbody.querySelectorAll('.status-select').forEach(function (select) {
          select.addEventListener('change', function () {
            updateStatus(select.getAttribute('data-id'), select.value, select);
          });
        });
      })
      .catch(function () {
        loading.style.display = 'none';
        empty.style.display = 'block';
        empty.textContent = 'Could not load bookings — please click Refresh.';
      });
  }

  function updateStats(bookings) {
    var total = bookings.length;
    var pending = 0, confirmed = 0, cancelled = 0;
    bookings.forEach(function (b) {
      var s = (b.status || 'pending').toLowerCase();
      if (s === 'confirmed') confirmed++;
      else if (s === 'cancelled') cancelled++;
      else pending++;
    });
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-confirmed').textContent = confirmed;
    document.getElementById('stat-cancelled').textContent = cancelled;
  }

  function rowHtml(b) {
    var received = b.timestamp ? new Date(b.timestamp).toLocaleString() : '';
    var status = (b.status || 'pending').toLowerCase();
    return (
      '<tr>' +
        '<td>' + escapeHtml(b.id) + '</td>' +
        '<td>' + escapeHtml(received) + '</td>' +
        '<td>' + escapeHtml(b.service) + '</td>' +
        '<td>' + escapeHtml(b.itemTitle) + '</td>' +
        '<td>' + escapeHtml(b.name) + '</td>' +
        '<td>' + escapeHtml(b.email) + '</td>' +
        '<td>' + escapeHtml(b.phone) + '</td>' +
        '<td>' + escapeHtml(b.date) + '</td>' +
        '<td>' + escapeHtml(b.notes) + '</td>' +
        '<td>' +
          '<select class="status-select status-' + status + '" data-id="' + escapeHtml(b.id) + '">' +
            ['pending', 'confirmed', 'cancelled'].map(function (s) {
              return '<option value="' + s + '"' + (s === status ? ' selected' : '') + '>' + s + '</option>';
            }).join('') +
          '</select>' +
        '</td>' +
      '</tr>'
    );
  }

  function updateStatus(id, status, selectEl) {
    selectEl.disabled = true;
    fetchJsonWithRetry(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'updateBookingStatus', id: id, status: status })
    })
      .then(function (result) {
        selectEl.disabled = false;
        if (result && result.success) {
          selectEl.className = 'status-select status-' + status;
          loadBookings(); // refresh stat cards too
        } else {
          alert('Could not update status — please try again.');
        }
      })
      .catch(function () {
        selectEl.disabled = false;
        alert('Network error — please try again.');
      });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ==================== MANAGE LISTINGS ====================
  var currentSheet = 'Tours';
  var editingId = null; // null = adding new, otherwise the id being edited

  var listingTabs = document.querySelectorAll('.listing-tab');
  var addListingBtn = document.getElementById('add-listing-btn');
  var listingModalOverlay = document.getElementById('listing-modal-overlay');
  var listingForm = document.getElementById('listing-form');
  var listingModalTitle = document.getElementById('listing-modal-title');
  var listingCategoryLabel = document.getElementById('listing-category-label');
  var listingModalCancel = document.getElementById('listing-modal-cancel');
  var listingModalStatus = document.getElementById('listing-modal-status');
  var listingModalSave = document.getElementById('listing-modal-save');
  var listingsCategoryHeader = document.getElementById('listings-category-header');

  listingTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      listingTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentSheet = tab.getAttribute('data-sheet');
      loadListings();
    });
  });

  addListingBtn.addEventListener('click', function () {
    openListingModal(null);
  });

  listingModalCancel.addEventListener('click', closeListingModal);
  listingModalOverlay.addEventListener('click', function (e) {
    if (e.target === listingModalOverlay) closeListingModal();
  });

  function isDealsSheet() {
    return currentSheet === 'Deals';
  }

  function loadListings() {
    var loading = document.getElementById('listings-loading');
    var empty = document.getElementById('listings-empty');
    var wrap = document.getElementById('listings-table-wrap');
    var tbody = document.getElementById('listings-tbody');

    listingsCategoryHeader.textContent = isDealsSheet() ? 'Badge' : 'Category';

    loading.textContent = 'Loading listings… (first load can take a few seconds)';
    loading.style.display = 'block';
    empty.style.display = 'none';
    wrap.style.display = 'none';

    fetchJsonWithRetry(API_BASE + '?action=adminListings&sheet=' + encodeURIComponent(currentSheet))
      .then(function (items) {
        loading.style.display = 'none';

        // If the backend returned an error object (e.g. an outdated Apps
        // Script deployment that doesn't recognise this action yet), show
        // that error directly instead of silently claiming "no listings".
        if (items && !Array.isArray(items) && items.error) {
          empty.style.display = 'block';
          empty.textContent = 'Backend error: ' + items.error + ' — check the Apps Script deployment is up to date.';
          return;
        }

        if (!items || !items.length) {
          empty.style.display = 'block';
          empty.textContent = 'No listings in this sheet yet.';
          return;
        }

        tbody.innerHTML = items.map(listingRowHtml).join('');
        wrap.style.display = 'block';

        tbody.querySelectorAll('.edit-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id');
            var item = items.find(function (i) { return String(i.id) === String(id); });
            if (item) openListingModal(item);
          });
        });

        tbody.querySelectorAll('.delete-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id');
            var title = btn.getAttribute('data-title');
            if (confirm('Delete "' + title + '"? This cannot be undone.')) {
              deleteListingRow(id);
            }
          });
        });
      })
      .catch(function () {
        loading.style.display = 'none';
        empty.style.display = 'block';
        empty.textContent = 'Could not load listings — please click Refresh.';
      });
  }

  function listingRowHtml(item) {
    var badgeOrCategory = isDealsSheet() ? item.badge : item.category;
    var isActive = String(item.active).toUpperCase() !== 'FALSE';
    return (
      '<tr>' +
        '<td>' + (item.image ? '<img class="listing-thumb" src="' + escapeHtml(item.image) + '" alt="">' : '') + '</td>' +
        '<td>' + escapeHtml(item.title) + '</td>' +
        '<td>' + escapeHtml(badgeOrCategory) + '</td>' +
        '<td>' + escapeHtml(item.price) + '</td>' +
        '<td><span class="active-pill ' + (isActive ? 'yes">Active' : 'no">Hidden') + '</span></td>' +
        '<td class="row-actions">' +
          '<button type="button" class="edit-btn" data-id="' + escapeHtml(item.id) + '">Edit</button>' +
          '<button type="button" class="delete-btn" data-id="' + escapeHtml(item.id) + '" data-title="' + escapeHtml(item.title) + '">Delete</button>' +
        '</td>' +
      '</tr>'
    );
  }

  function openListingModal(item) {
    editingId = item ? item.id : null;
    listingModalTitle.textContent = item ? ('Edit: ' + item.title) : 'Add New Listing';
    listingCategoryLabel.childNodes[0].textContent = isDealsSheet() ? 'Badge' : 'Category';
    listingModalStatus.textContent = '';
    listingModalStatus.className = '';
    listingModalSave.disabled = false;

    listingForm.reset();
    if (item) {
      listingForm.title.value = item.title || '';
      listingForm.category.value = (isDealsSheet() ? item.badge : item.category) || '';
      listingForm.meta1.value = item.meta1 || '';
      listingForm.meta2.value = item.meta2 || '';
      listingForm.rating.value = item.rating || '';
      listingForm.reviews.value = item.reviews || '';
      listingForm.price.value = item.price || '';
      listingForm.priceNote.value = item.priceNote || '';
      listingForm.image.value = item.image || '';
      listingForm.active.checked = String(item.active).toUpperCase() !== 'FALSE';
    } else {
      listingForm.active.checked = true;
    }

    listingModalOverlay.classList.add('visible');
  }

  function closeListingModal() {
    listingModalOverlay.classList.remove('visible');
    editingId = null;
  }

  listingForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var categoryFieldName = isDealsSheet() ? 'badge' : 'category';
    var item = {
      title: listingForm.title.value.trim(),
      meta1: listingForm.meta1.value.trim(),
      meta2: listingForm.meta2.value.trim(),
      rating: listingForm.rating.value.trim(),
      reviews: listingForm.reviews.value.trim(),
      price: listingForm.price.value.trim(),
      priceNote: listingForm.priceNote.value.trim(),
      image: listingForm.image.value.trim(),
      active: listingForm.active.checked
    };
    item[categoryFieldName] = listingForm.category.value.trim();

    listingModalSave.disabled = true;
    listingModalStatus.textContent = 'Saving…';
    listingModalStatus.className = '';

    var payload = editingId
      ? { action: 'updateListing', sheet: currentSheet, id: editingId, item: item }
      : { action: 'addListing', sheet: currentSheet, item: item };

    fetchJsonWithRetry(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (result) {
        if (result && result.success) {
          listingModalStatus.textContent = 'Saved!';
          listingModalStatus.className = 'ok';
          setTimeout(function () {
            closeListingModal();
            loadListings();
          }, 600);
        } else {
          listingModalStatus.textContent = (result && result.error) || 'Could not save — please try again.';
          listingModalStatus.className = 'err';
          listingModalSave.disabled = false;
        }
      })
      .catch(function () {
        listingModalStatus.textContent = 'Network error — please try again.';
        listingModalStatus.className = 'err';
        listingModalSave.disabled = false;
      });
  });

  function deleteListingRow(id) {
    fetchJsonWithRetry(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteListing', sheet: currentSheet, id: id })
    })
      .then(function (result) {
        if (result && result.success) {
          loadListings();
        } else {
          alert('Could not delete — please try again.');
        }
      })
      .catch(function () {
        alert('Network error — please try again.');
      });
  }
});
