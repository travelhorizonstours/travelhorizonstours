document.addEventListener('DOMContentLoaded', function () {
  var loginWrap = document.getElementById('staff-login-wrap');
  var shell = document.getElementById('staff-shell');
  var loginForm = document.getElementById('staff-login-form');
  var loginError = document.getElementById('staff-login-error');
  var logoutBtn = document.getElementById('staff-logout');
  var refreshBtn = document.getElementById('refresh-bookings');
  var welcomeEl = document.getElementById('staff-welcome');

  function isLoggedIn() {
    return sessionStorage.getItem('bh_staff_logged_in') === 'true';
  }

  function showDashboard() {
    loginWrap.style.display = 'none';
    shell.classList.add('visible');
    var username = sessionStorage.getItem('bh_staff_username') || '';
    welcomeEl.textContent = username ? ('Signed in as ' + username) : '';
    loadBookings();
  }

  function showLogin() {
    shell.classList.remove('visible');
    loginWrap.style.display = 'block';
  }

  if (isLoggedIn()) {
    showDashboard();
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var username = document.getElementById('staff-username').value.trim();
    var password = document.getElementById('staff-password').value;
    loginError.textContent = '';

    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', username: username, password: password })
    })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (result && result.success) {
          sessionStorage.setItem('bh_staff_logged_in', 'true');
          sessionStorage.setItem('bh_staff_username', username);
          showDashboard();
        } else {
          loginError.textContent = 'Invalid username or password.';
        }
      })
      .catch(function () {
        loginError.textContent = 'Network error — please try again.';
      });
  });

  logoutBtn.addEventListener('click', function () {
    sessionStorage.removeItem('bh_staff_logged_in');
    sessionStorage.removeItem('bh_staff_username');
    showLogin();
  });

  refreshBtn.addEventListener('click', loadBookings);

  // Sidebar: "Bookings" and "Dashboard" both show the same panel for now
  // (kept as separate nav items since more panels are coming later)
  document.querySelectorAll('.sidebar-item[data-panel]').forEach(function (item) {
    item.addEventListener('click', function () {
      document.querySelectorAll('.sidebar-item[data-panel]').forEach(function (i) {
        i.classList.remove('active');
      });
      item.classList.add('active');
    });
  });

  function loadBookings() {
    var loading = document.getElementById('bookings-loading');
    var empty = document.getElementById('bookings-empty');
    var table = document.getElementById('bookings-table');
    var tbody = document.getElementById('bookings-tbody');

    loading.style.display = 'block';
    empty.style.display = 'none';
    table.style.display = 'none';

    fetch(API_BASE + '?action=bookings')
      .then(function (res) { return res.json(); })
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
        empty.textContent = 'Could not load bookings — please refresh.';
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
    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'updateBookingStatus', id: id, status: status })
    })
      .then(function (res) { return res.json(); })
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
});
