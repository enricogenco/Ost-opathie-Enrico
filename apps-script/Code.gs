/**
 * Google Apps Script - Backend pour le systeme de reservation
 * Enrico Genco - Osteopathe
 *
 * INSTRUCTIONS DE DEPLOIEMENT :
 * 1. Allez sur https://script.google.com et creez un nouveau projet
 * 2. Collez ce code dans le fichier Code.gs
 * 3. Configurez les variables ci-dessous
 * 4. Deployer > Nouveau deploiement > Application Web
 *    - Executer en tant que : Moi
 *    - Acces : Tout le monde
 * 5. Copiez l'URL du deploiement et collez-la dans js/booking.js (variable APPS_SCRIPT_URL)
 */

// ===== CONFIGURATION =====
const CONFIG = {
  CALENDAR_ID: 'primary', // ou l'ID du calendrier Google specifique
  OSTEO_EMAIL: 'osteogenco@gmail.com',
  OSTEO_NAME: 'Enrico Genco',
  CONSULTATION_DURATION: 45, // minutes
  TIMEZONE: 'Europe/Brussels',
  OPENING_DATE: '2026-10-01',

  // Creneaux disponibles selon le jour
  SLOTS_BY_DAY: {
    // Lundi
    1: [
      '08:00', '08:45', '09:30', '10:15',
      '11:00', '11:45', '12:30', '13:15',
      '14:00', '14:45', '15:30', '16:15',
      '17:00', '17:45', '18:15'
    ],

    // Samedi
    6: [
      '08:00', '08:45', '09:30',
      '10:15', '11:00', '11:45'
    ]
  },

  AVAILABLE_DAYS: [1, 6],

  // Adresse de ton nouveau site
  SITE_URL: 'https://enricogenco.github.io/Ost-opathie-Enrico/'
};

// ===== CORS HEADERS =====
function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== GET HANDLER =====
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getSlots') {
    return jsonOutput(getAvailableSlots(e.parameter.date));
  }

  return jsonOutput({ error: 'Unknown action' });
}

// ===== POST HANDLER =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'book') {
      return jsonOutput(bookAppointment(data));
    }

    return jsonOutput({ error: 'Unknown action' });

  } catch (err) {
    return jsonOutput({
      success: false,
      message: 'Erreur serveur: ' + err.message
    });
  }
}

// ===== GET AVAILABLE SLOTS =====
function getSlotsForDate(dateStr) {
  // Midi évite certains problèmes de changement de date liés au fuseau horaire
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDay();

  return CONFIG.SLOTS_BY_DAY[day] || [];
}

function getAvailableSlots(dateStr) {
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const date = new Date(dateStr + 'T00:00:00');

  // Get all events for this day
  const startOfDay = new Date(dateStr + 'T00:00:00');
  const endOfDay = new Date(dateStr + 'T23:59:59');
  const events = calendar.getEvents(startOfDay, endOfDay);

  // Find which slots are booked
  const bookedSlots = [];

  const slots = getSlotsForDate(dateStr);

  slots.forEach(slot => {
    const [hours, minutes] = slot.split(':').map(Number);
    const slotStart = new Date(dateStr + 'T' + slot + ':00');
    const slotEnd = new Date(slotStart.getTime() + CONFIG.CONSULTATION_DURATION * 60000);

    // Check if any event overlaps with this slot
    const isBooked = events.some(event => {
      const eventStart = event.getStartTime();
      const eventEnd = event.getEndTime();
      return (slotStart < eventEnd && slotEnd > eventStart);
    });

    if (isBooked) {
      bookedSlots.push(slot);
    }
  });

  return {
    date: dateStr,
    bookedSlots: bookedSlots,
    allSlots: slots
  };
}

// ===== BOOK APPOINTMENT =====
function bookAppointment(data) {
  const { date, time, name, email, phone, motif, message } = data;

  // Validate
  if (!date || !time || !name || !email || !phone) {
    return { success: false, message: 'Informations manquantes.' };
  }

  const allowedSlots = getSlotsForDate(date);

  if (!allowedSlots.includes(time)) {
    return {
      success: false,
      message: 'Ce jour ou cet horaire n’est pas disponible.'
    };
  }

  // Check slot is still available
  const available = getAvailableSlots(date);
  if (available.bookedSlots.includes(time)) {
    return {
      success: false,
      message: 'Ce creneau vient d\'etre reserve. Veuillez en choisir un autre.'
    };
  }

  // Create calendar event
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const startTime = new Date(date + 'T' + time + ':00');
  const endTime = new Date(startTime.getTime() + CONFIG.CONSULTATION_DURATION * 60000);

  const eventTitle = `Consultation Osteo - ${name}`;
  const eventDescription = [
    `Patient : ${name}`,
    `Email : ${email}`,
    `Telephone : ${phone}`,
    motif ? `Motif : ${motif}` : '',
    message ? `Message : ${message}` : '',
    '',
    '---',
    'Reservation en ligne - enrico-genco-osteopathe'
  ].filter(Boolean).join('\n');

  const event = calendar.createEvent(eventTitle, startTime, endTime, {
    description: eventDescription
  });

  // Send confirmation email to patient
  sendConfirmationEmail(data, startTime, endTime);

  // Send notification to osteopath
  sendNotificationEmail(data, startTime, endTime);

  return {
    success: true,
    message: 'Rendez-vous confirme !',
    eventId: event.getId()
  };
}

// ===== SEND CONFIRMATION EMAIL TO PATIENT =====
function sendConfirmationEmail(data, startTime, endTime) {
  const { name, email, phone, motif, date, time } = data;

  const dateFormatted = Utilities.formatDate(startTime, CONFIG.TIMEZONE, "EEEE d MMMM yyyy");
  const timeFormatted = Utilities.formatDate(startTime, CONFIG.TIMEZONE, "HH:mm");
  const endFormatted = Utilities.formatDate(endTime, CONFIG.TIMEZONE, "HH:mm");

  const subject = `Confirmation de votre rendez-vous - ${CONFIG.OSTEO_NAME}`;

  const htmlBody = `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #1b4d3e; color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">${CONFIG.OSTEO_NAME}</h1>
      <p style="margin: 8px 0 0; opacity: 0.85;">Osteopathe D.O. - Bruxelles</p>
    </div>
    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1b4d3e; margin-top: 0;">Rendez-vous confirme</h2>
      <p>Bonjour ${name},</p>
      <p>Votre rendez-vous a bien ete enregistre :</p>
      <div style="background: #e8f5f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 4px 0;"><strong>Date :</strong> ${dateFormatted}</p>
        <p style="margin: 4px 0;"><strong>Heure :</strong> ${timeFormatted} - ${endFormatted}</p>
        ${motif ? `<p style="margin: 4px 0;"><strong>Motif :</strong> ${motif}</p>` : ''}
      </div>
      <h3 style="color: #1b4d3e;">Informations importantes</h3>
      <ul style="color: #6b7280; line-height: 1.8;">
        <li><strong>Adultes :</strong> Merci d'apporter vos examens complementaires (radiographies, IRM, etc.).</li>
        <li><strong>Pediatrie :</strong> Merci d'apporter le carnet de sante de votre enfant.</li>
        <li><strong>Tarif :</strong> 65 euros la consultation.</li>
        <li><strong>Annulation :</strong> Merci de prevenir au moins 24h a l'avance. Tout rendez-vous non annule sera facture.</li>
      </ul>
      <p style="color: #6b7280; margin-top: 24px; font-size: 14px;">
        Pour annuler ou modifier votre rendez-vous, contactez-nous :<br>
        Tel : +32 484 43 86 14<br>
        Email : ${CONFIG.OSTEO_EMAIL}
      </p>
    </div>
  </div>
  `;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: htmlBody,
    name: CONFIG.OSTEO_NAME + ' - Osteopathe',
    replyTo: CONFIG.OSTEO_EMAIL
  });
}

// ===== SEND NOTIFICATION EMAIL TO OSTEOPATH =====
function sendNotificationEmail(data, startTime, endTime) {
  const { name, email, phone, motif, message } = data;

  const dateFormatted = Utilities.formatDate(startTime, CONFIG.TIMEZONE, "EEEE d MMMM yyyy");
  const timeFormatted = Utilities.formatDate(startTime, CONFIG.TIMEZONE, "HH:mm");

  const subject = `Nouveau RDV : ${name} - ${dateFormatted} a ${timeFormatted}`;

  const htmlBody = `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #1b4d3e;">Nouveau rendez-vous</h2>
    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">
      <p><strong>Patient :</strong> ${name}</p>
      <p><strong>Date :</strong> ${dateFormatted} a ${timeFormatted}</p>
      <p><strong>Email :</strong> ${email}</p>
      <p><strong>Telephone :</strong> ${phone}</p>
      ${motif ? `<p><strong>Motif :</strong> ${motif}</p>` : ''}
      ${message ? `<p><strong>Message :</strong> ${message}</p>` : ''}
    </div>
  </div>
  `;

  MailApp.sendEmail({
    to: CONFIG.OSTEO_EMAIL,
    subject: subject,
    htmlBody: htmlBody
  });
}
