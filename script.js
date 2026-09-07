document.addEventListener('DOMContentLoaded', function () {
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

  // Search submit: demo-only, no backend wired up
  var form = document.querySelector('#search-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      alert("This search isn't connected to live listings yet — it's a working draft of the interface.");
    });
  }
});
