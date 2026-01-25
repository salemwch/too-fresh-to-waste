Cahier des Charges - RescueEats App

1. PRÉSENTATION GÉNÉRALE DU PROJET 1.1 Contexte Développement d'une application
   mobile de type marketplace permettant aux restaurants, boulangeries et
   commerces alimentaires de vendre leurs invendus à prix réduit aux
   consommateurs, réduisant ainsi le gaspillage alimentaire. 1.2 Objectifs

Objectif principal : Créer une plateforme efficace de lutte contre le gaspillage
alimentaire Objectifs secondaires :

Générer des revenus additionnels pour les commerçants Offrir des repas de
qualité à prix accessibles Créer une communauité engagée dans l'anti-gaspillage

1.3 Périmètre du projet

Application mobile native (iOS/Android) Interface web d'administration pour les
commerçants Backend avec API REST Système de paiement intégré Géolocalisation et
notifications push

2. ANALYSE FONCTIONNELLE 2.1 Acteurs du système Utilisateur final (Consommateur)

Recherche et achète des produits en surplus Consulte les offres géolocalisées
Effectue des paiements sécurisés Évalue les commerçants

Commerçant partenaire

Crée et gère ses offres de surplus Définit les créneaux de retrait Suit ses
ventes et statistiques Gère son profil établissement

Administrateur plateforme

Supervise la plateforme Valide les nouveaux commerçants Gère les litiges Analyse
les performances

2.2 Cas d'usage principaux A. Pour l'utilisateur consommateur

Inscription/Connexion

Création compte avec email/téléphone Authentification via réseaux sociaux
(Google, Apple) Vérification par SMS

Recherche d'offres

Géolocalisation automatique Recherche par catégorie (boulangerie, restaurant,
etc.) Filtres par prix, distance, type de cuisine Vue carte et vue liste

Commande

Sélection d'un "panier surprise" Choix du créneau de retrait Paiement sécurisé
(CB, PayPal, Apple Pay) Confirmation par notification

Retrait

QR Code de confirmation Géolocalisation du commerce Timer de rappel Photos du
produit retiré

B. Pour le commerçant

Inscription/Validation

Création profil établissement Upload documents (SIRET, licence) Validation
manuelle par admin

Gestion des offres

Création panier surprise avec photos Prix original vs prix réduit Définition
créneaux de retrait Gestion stock en temps réel

Suivi commercial

Dashboard des ventes Statistiques de performance Historique des commandes
Gestion des avis clients

C. Pour l'administrateur

Validation des partenaires

Vérification documents Approbation/refus inscription Gestion liste d'attente

Supervision plateforme

Modération avis clients Résolution litiges Analytics globales Gestion des
paiements

3. SPÉCIFICATIONS TECHNIQUES 3.1 Architecture technique - Séparation
   Frontend/Backend BACKEND API (À développer en premier) Framework & Runtime

Runtime : Node.js 18+ Framework : NestJS (TypeScript) Architecture : RESTful API
avec validation Authentication : JWT + Refresh Tokens File Upload : Multer +
Local Storage Email : SendGrid/Nodemailer SMS : Twilio (optionnel)

Base de données

Principal : MongoDB avec Mongoose Structure : Collections optimisées pour NoSQL
Indexation : Géospatiale pour recherche proximité Files : GridFS pour images ou
stockage local

Structure Backend backend/ ├── src/ │ ├── auth/ # Module authentification │ ├──
users/ # Gestion utilisateurs │ ├── establishments/ # Gestion établissements │
├── offers/ # Gestion offres │ ├── orders/ # Gestion commandes │ ├── payments/ #
Intégration Stripe │ ├── reviews/ # Système d'avis │ ├── notifications/ # Push &
Email │ ├── uploads/ # Gestion fichiers │ └── common/ # Guards, decorators,
pipes ├── uploads/ # Stockage local images ├── package.json └── README.md
Technologies Backend

TypeScript : 5.0+ NestJS : 10.0+ MongoDB : 7.0+ Mongoose : 8.0+ Passport JWT :
Authentification Stripe : Paiements Multer : Upload fichiers Class-validator :
Validation DTOs

FRONTEND (À développer après le backend) Frontend Mobile (React Native)
mobile-app/ ├── src/ │ ├── components/ # Composants réutilisables │ ├──
screens/ # Écrans principaux │ ├── navigation/ # Navigation React Navigation │
├── services/ # API calls │ ├── store/ # State management │ ├── utils/ #
Utilitaires │ └── assets/ # Images, icons ├── package.json └── README.md
Technologies Mobile

React Native : 0.81.4+ TypeScript : 5.9.2+ React Navigation : 7.1.17+ React
Query : State server React Native Maps : Géolocalisation Stripe React Native :
Paiements

Frontend Web Admin (Next.js) web-admin/ ├── src/ │ ├── app/ # App Router Next.js
14 │ ├── components/ # Composants UI │ ├── lib/ # API clients, utils │ ├──
store/ # State management │ └── types/ # TypeScript types ├── public/ # Assets
statiques ├── package.json └── README.md Technologies Web

Next.js : 15.5.3+ (App Router) React : 19.1+ TypeScript : 5.9.2+ Tailwind CSS :
Styling React Hook Form : Formulaires React Query : State server Recharts :
Graphiques

Frontend Web Client (Next.js ) web-client/ ├── src/ │ ├── app/ # Pages publiques
│ ├── components/ # UI components │ └── lib/ # API services ├── package.json └──
README.md

3.4 Sécurité Authentification & Autorisation

JWT avec refresh tokens (durée vie : 15min access, 7j refresh) Hash passwords
avec bcrypt (salt rounds: 12) Rate limiting par IP et utilisateur CORS configuré
strictement Validation input avec Joi/Zod

Protection données

Chiffrement données sensibles (AES-256) HTTPS obligatoire (TLS 1.3) Audit logs
pour actions critiques RGPD compliant (droit à l'oubli) Anonymisation données
analytics

Validation & Sanitisation

Validation serveur systématique Protection XSS et injection SQL Upload fichiers
sécurisé (type/taille) Sanitisation des entrées utilisateur

4. SPÉCIFICATIONS FONCTIONNELLES DÉTAILLÉES 4.1 Interface utilisateur mobile
   Écran d'accueil

Géolocalisation automatique avec permission Carte interactive avec pins des
offres Barre de recherche et filtres Carrousel des offres populaires Navigation
bottom tabs

Écran offre détaillée

Carrousel photos haute résolution Informations établissement (nom, adresse,
rating) Description produits, prix barré/réduit Créneaux disponibles pour
retrait Bouton achat avec loading states Avis clients avec photos

Écran commande

Récapitulatif achat Informations retrait (lieu, horaires) QR Code unique pour
retrait Bouton "J'ai récupéré" avec géofencing Possibilité annulation
(conditions)

Écran profil

Informations personnelles modifiables Historique commandes avec détails
Préférences notifications Programme fidélité (points, badges) Support client et
FAQ

4.2 Interface web commerçant Dashboard principal

KPIs temps réel (CA jour, semaine, mois) Graphiques ventes et tendances Alertes
et notifications importantes Raccourcis actions fréquentes

Gestion offres

Liste offres avec statuts Création rapide avec templates Upload multiple photos
avec crop Planification offres récurrentes Gestion stock temps réel

Analytics & Reporting

Statistiques détaillées ventes Analyse clientèle et rétention Comparatif
performances périodes Export données CSV/PDF Recommandations optimisation

4.3 Système de notifications Push notifications mobile

Nouvelles offres à proximité Rappel retrait commande Promotions personnalisées
Updates statut commande

Email notifications

Confirmation commande Rappel retrait J-1 et J-0 Newsletter hebdomadaire offres
Notifications administratives

SMS notifications (optionnel)

Code de retrait Rappel urgent retrait Notifications critiques sécurité

5. CRITÈRES DE QUALITÉ ET PERFORMANCE 5.1 Performance Application mobile

Temps de lancement : < 3 secondes Navigation fluide : 60 FPS minimum Chargement
liste offres : < 2 secondes Temps de réponse API : < 500ms (95e percentile)

Disponibilité

Uptime : 99.9% minimum Recovery time : < 15 minutes Scalabilité : 10x traffic
peaks support Load testing : 1000 utilisateurs simultanés

5.2 Compatibilité Mobile

iOS : 14.0+ (iPhone 6S et plus récents) Android : API 23+ (Android 6.0+) Support
mode hors-ligne basique Optimisation batteries et données

Web

Navigateurs : Chrome 80+, Safari 13+, Firefox 75+ Responsive design
(mobile-first) PWA capabilities Accessibilité WCAG 2.1 AA

5.3 Monitoring et Analytics Monitoring technique

APM avec Sentry/DataDog Logs centralisés (ELK Stack) Alertes automatiques pannes
Health checks endpoints

Analytics business

Google Analytics 4 Mixpanel pour événements custom Hotjar pour UX analytics A/B
testing capability
