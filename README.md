# Enrico Genco - Osteopathe a Bruxelles

Site web professionnel avec systeme de prise de rendez-vous en ligne connecte a Google Calendar.

## Deploiement du site

Le site est heberge sur GitHub Pages. Il est automatiquement deploye depuis la branche `main`.

URL : https://maxc55.github.io/enrico-genco-osteopathe

## Configuration du backend Google Calendar

Le systeme de reservation utilise Google Apps Script comme backend gratuit pour se connecter a Google Calendar.

### Etapes de configuration :

1. **Creer le Google Apps Script :**
   - Connectez-vous au compte Google d'Enrico (osteogenco@gmail.com)
   - Allez sur [script.google.com](https://script.google.com)
   - Cliquez sur "Nouveau projet"
   - Supprimez le contenu par defaut et collez le contenu du fichier `apps-script/Code.gs`

2. **Deployer l'application web :**
   - Cliquez sur "Deployer" > "Nouveau deploiement"
   - Type : "Application Web"
   - Executer en tant que : "Moi"
   - Acces : "Tout le monde"
   - Cliquez sur "Deployer"
   - **Autorisez l'acces** quand Google le demande (acces au calendrier et aux emails)
   - Copiez l'URL du deploiement

3. **Connecter le frontend :**
   - Ouvrez `js/booking.js`
   - Remplacez la valeur de `APPS_SCRIPT_URL` (ligne 3) par l'URL copiee
   - Committez et poussez le changement

4. **Tester :**
   - Allez sur le site et essayez de prendre un rendez-vous
   - Verifiez que l'evenement apparait dans Google Calendar
   - Verifiez que les emails de confirmation sont envoyes

### Fonctionnement :

- **GET** `?action=getSlots&date=YYYY-MM-DD` : Retourne les creneaux deja reserves pour une date
- **POST** `{action: 'book', ...}` : Reserve un creneau, cree l'evenement dans Google Calendar, et envoie les emails de confirmation

### Personnalisation des creneaux :

Modifiez la variable `SLOTS` dans `js/booking.js` et dans `apps-script/Code.gs` pour ajuster les horaires disponibles.

## Configuration des emails de confirmation (EmailJS)

EmailJS permet d'envoyer des emails directement depuis le frontend (gratuit jusqu'a 200 emails/mois).

### Etapes :

1. **Creer un compte** sur [emailjs.com](https://www.emailjs.com) (gratuit)

2. **Ajouter un service email :**
   - Email Services > Add New Service > Gmail
   - Connecter le compte osteogenco@gmail.com

3. **Creer le template pour le patient** (Email Templates > Create New) :
   - Nom : "Confirmation Patient"
   - To Email : `{{patient_email}}`
   - Subject : `Confirmation de votre rendez-vous - Enrico Genco`
   - Content :
   ```
   Bonjour {{patient_name}},

   Votre rendez-vous a bien ete confirme :

   Date : {{appointment_date}}
   Heure : {{appointment_time}}
   Motif : {{motif}}

   Tarif : 65 euros

   Merci d'apporter vos examens complementaires (radiographies, IRM, etc.).
   En cas d'annulation, merci de prevenir au moins 24h a l'avance.

   Cordialement,
   Enrico Genco - Osteopathe
   +32 484 43 86 14
   ```
   - Notez le **Template ID**

4. **Creer le template pour Enrico** (notification) :
   - Nom : "Notification Osteo"
   - To Email : `osteogenco@gmail.com`
   - Subject : `Nouveau RDV : {{patient_name}} - {{appointment_date}} a {{appointment_time}}`
   - Content :
   ```
   Nouveau rendez-vous en ligne :

   Patient : {{patient_name}}
   Email : {{patient_email}}
   Telephone : {{patient_phone}}
   Date : {{appointment_date}}
   Heure : {{appointment_time}}
   Motif : {{motif}}
   Message : {{message}}
   ```
   - Notez le **Template ID**

5. **Recuperer les identifiants :**
   - Service ID : Email Services > votre service > Service ID
   - Public Key : Account > API Keys > Public Key

6. **Configurer dans le code :**
   - Ouvrez `js/booking.js`
   - Remplissez les 4 constantes EmailJS en haut du fichier
   - Committez et poussez

## Structure du projet

```
index.html          - Page principale (FR / NL / EN)
css/style.css       - Styles
js/i18n.js          - Dictionnaire de traduction et logique du selecteur de langue
js/booking.js       - Logique frontend (calendrier + reservation)
apps-script/Code.gs - Backend Google Apps Script
assets/portrait.jpg - Photo de profil
```

## Langues

Le site est disponible en francais, neerlandais et anglais via le selecteur de langue (FR / NL / EN) en haut a gauche de la barre de navigation. Le choix de langue est memorise dans le navigateur du visiteur (localStorage). Pour ajouter ou modifier des traductions, editez le dictionnaire `TRANSLATIONS` dans `js/i18n.js`.
