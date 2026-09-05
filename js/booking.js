// ===== CONFIGURATION =====
// Replace this URL with your deployed Google Apps Script Web App URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx1eY50_cwXzjZrdhFckJh7T4OathdcTtuZp9BGFHmfq5vR4FoP6u57sn6xvs-YMq1S/exec';

// ===== EMAILJS CONFIGURATION =====
// 1. Créer un compte gratuit sur https://www.emailjs.com
// 2. Ajouter un service email (Gmail de osteogenco@gmail.com)
// 3. Créer deux templates (voir README pour les variables)
// 4. Remplir les valeurs ci-dessous
const EMAILJS_PUBLIC_KEY = '';      // Account > API Keys > Public Key
const EMAILJS_SERVICE_ID = '';      // Email Services > Service ID
const EMAILJS_TEMPLATE_PATIENT = '';  // Template ID pour le patient
const EMAILJS_TEMPLATE_OSTEO = '';    // Template ID pour Enrico

// ===== NAVBAR =====
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 10);
});

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

// Close mobile nav on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ===== BOOKING SYSTEM =====
const WEEKDAYS_AVAILABLE = [1, 6]; // 1 = lundi, 6 = samedi

const SLOTS_BY_DAY = {
  // Lundi : 08:00 à 19:00, consultations de 45 minutes
  1: [
    '08:00', '08:45', '09:30', '10:15',
    '11:00', '11:45', '12:30', '13:15',
    '14:00', '14:45', '15:30', '16:15',
    '17:00', '17:45', '18:15'
  ],

  // Samedi : 08:00 à 12:30
  6: [
    '08:00', '08:45', '09:30',
    '10:15', '11:00', '11:45'
  ]
};

function getSlotsForDate(date) {
  return SLOTS_BY_DAY[date.getDay()] || [];
}

let currentMonth = new Date();
let selectedDate = null;
let selectedSlot = null;
let bookedSlots = {}; // Cache: { 'YYYY-MM-DD': ['09:00', '10:30', ...] }
let lastFormData = null; // Cache for re-rendering confirmation on language change

const calDays = document.getElementById('calDays');
const calMonth = document.getElementById('calMonth');
const calPrev = document.getElementById('calPrev');
const calNext = document.getElementById('calNext');
const slotsTitle = document.getElementById('slotsTitle');
const slotsList = document.getElementById('slotsList');

const step1 = document.getElementById('bookingStep1');
const step2 = document.getElementById('bookingStep2');
const step3 = document.getElementById('bookingStep3');

function monthName(index) {
  return t(`month.${index}`);
}

function dayName(index) {
  return t(`day.${index}`);
}

function renderCalendar() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  calMonth.textContent = `${monthName(month)} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday = 0, Sunday = 6
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  calDays.innerHTML = '';

  // Empty cells for days before start
  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day';
    calDays.appendChild(empty);
  }

  // Days of month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const btn = document.createElement('button');
    btn.className = 'calendar-day';
    btn.textContent = d;

    const isWeekday = WEEKDAYS_AVAILABLE.includes(date.getDay());
    const isFuture = date >= today;

    if (isWeekday && isFuture) {
      btn.classList.add('available');
      btn.addEventListener('click', () => selectDate(date));
    }

    if (date.getTime() === today.getTime()) {
      btn.classList.add('today');
    }

    if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
      btn.classList.add('selected');
    }

    calDays.appendChild(btn);
  }
}

function formatDateLong(date) {
  return `${dayName(date.getDay())} ${date.getDate()} ${monthName(date.getMonth())} ${date.getFullYear()}`;
}

function dateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function selectDate(date) {
  selectedDate = date;
  selectedSlot = null;
  renderCalendar();

  slotsTitle.textContent = formatDateLong(date);
  slotsList.innerHTML = `<p class="slots-empty">${t('slots.loading')}</p>`;

  const dateStr = dateToStr(date);
  let busySlots = [];

  if (APPS_SCRIPT_URL) {
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=getSlots&date=${dateStr}`);
      const data = await res.json();
      if (data.bookedSlots) {
        busySlots = data.bookedSlots;
      }
    } catch (err) {
      console.warn('Could not fetch booked slots, showing all as available:', err);
    }
  }

  bookedSlots[dateStr] = busySlots;
  renderSlots(dateStr, busySlots);
}

function renderSlots(dateStr, busySlots) {
  slotsList.innerHTML = '';
  let anyAvailable = false;

  // Filter out past slots if selected date is today
  const now = new Date();
  const isToday = dateStr === dateToStr(now);

  getSlotsForDate(selectedDate).forEach(slot => {
    if (isToday) {
      const [h, m] = slot.split(':').map(Number);
      if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
        return;
      }
    }

    if (busySlots.includes(slot)) return;

    anyAvailable = true;
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    btn.textContent = slot;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSlot = slot;
      goToStep2();
    });
    slotsList.appendChild(btn);
  });

  if (!anyAvailable) {
    slotsList.innerHTML = `<p class="slots-empty">${t('slots.none')}</p>`;
  }
}

function goToStep2() {
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
  step3.classList.add('hidden');

  document.getElementById('summaryDate').textContent = formatDateLong(selectedDate);
  document.getElementById('summaryTime').textContent = `${selectedSlot}${t('slots.consultationSuffix')}`;
}

document.getElementById('backToCalendar').addEventListener('click', () => {
  step1.classList.remove('hidden');
  step2.classList.add('hidden');
});

// Form submission
document.getElementById('bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('bookSubmit');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> ${t('form.submitting')}`;

  const formData = {
    action: 'book',
    date: dateToStr(selectedDate),
    time: selectedSlot,
    name: document.getElementById('bookName').value.trim(),
    email: document.getElementById('bookEmail').value.trim(),
    phone: document.getElementById('bookPhone').value.trim(),
    motif: document.getElementById('bookMotif').value,
    message: document.getElementById('bookMessage').value.trim()
  };

  let success = false;

  if (APPS_SCRIPT_URL) {
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      success = data.success;
      if (!success) {
        alert(data.message || t('alert.slotTaken'));
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
      }
    } catch (err) {
      console.error('Booking error:', err);
      alert(t('alert.connectionError'));
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }
  } else {
    success = true;
  }

  // Send confirmation emails via EmailJS
  if (success && EMAILJS_PUBLIC_KEY && EMAILJS_SERVICE_ID) {
    const emailParams = {
      patient_name: formData.name,
      patient_email: formData.email,
      patient_phone: formData.phone,
      appointment_date: formatDateLong(selectedDate),
      appointment_time: formData.time,
      motif: formData.motif || '-',
      message: formData.message || '-'
    };

    try {
      // Email de confirmation au patient
      if (EMAILJS_TEMPLATE_PATIENT) {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_PATIENT, emailParams, EMAILJS_PUBLIC_KEY);
      }
      // Email de notification a Enrico
      if (EMAILJS_TEMPLATE_OSTEO) {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_OSTEO, emailParams, EMAILJS_PUBLIC_KEY);
      }
    } catch (emailErr) {
      console.warn('Emails could not be sent:', emailErr);
    }
  }

  if (success) {
    lastFormData = formData;
    goToStep3(formData);
  }
});

function renderConfirmationDetails(data) {
  document.getElementById('confirmationDetails').innerHTML = `
    <p><strong>${t('confirmation.date')} :</strong> ${formatDateLong(selectedDate)}</p>
    <p><strong>${t('confirmation.time')} :</strong> ${data.time}</p>
    <p><strong>${t('confirmation.name')} :</strong> ${data.name}</p>
    <p><strong>${t('confirmation.email')} :</strong> ${data.email}</p>
    ${data.motif ? `<p><strong>${t('confirmation.motif')} :</strong> ${data.motif}</p>` : ''}
  `;
}

function goToStep3(data) {
  step1.classList.add('hidden');
  step2.classList.add('hidden');
  step3.classList.remove('hidden');

  renderConfirmationDetails(data);

  // Reset form
  document.getElementById('bookingForm').reset();
}

document.getElementById('newBooking').addEventListener('click', () => {
  selectedDate = null;
  selectedSlot = null;
  lastFormData = null;
  step1.classList.remove('hidden');
  step2.classList.add('hidden');
  step3.classList.add('hidden');
  slotsTitle.textContent = t('slots.selectDateTitle');
  slotsList.innerHTML = `<p class="slots-empty">${t('slots.selectDateHint')}</p>`;
  renderCalendar();
});

calPrev.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
});

calNext.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
});

// Re-render dynamic (JS-generated) text when the language changes
document.addEventListener('languagechange', () => {
  renderCalendar();

  if (!step1.classList.contains('hidden')) {
    if (selectedDate) {
      slotsTitle.textContent = formatDateLong(selectedDate);
      renderSlots(dateToStr(selectedDate), bookedSlots[dateToStr(selectedDate)] || []);
    } else {
      slotsTitle.textContent = t('slots.selectDateTitle');
      slotsList.innerHTML = `<p class="slots-empty">${t('slots.selectDateHint')}</p>`;
    }
  }

  if (!step2.classList.contains('hidden') && selectedDate && selectedSlot) {
    document.getElementById('summaryDate').textContent = formatDateLong(selectedDate);
    document.getElementById('summaryTime').textContent = `${selectedSlot}${t('slots.consultationSuffix')}`;
  }

  if (!step3.classList.contains('hidden') && lastFormData) {
    renderConfirmationDetails(lastFormData);
  }
});

// Init
renderCalendar();

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
