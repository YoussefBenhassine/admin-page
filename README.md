# 🎛️ Interface Admin - Email Campaign Manager

Interface d'administration web pour la gestion des licences et des machines du Email Campaign Manager.

## 🚀 Fonctionnalités

- **Gestion des licences** : Création, modification, suppression de licences
- **Suivi des machines** : Enregistrement et monitoring des machines connectées
- **Paramètres système** : Configuration de la durée d'essai et du nombre de machines
- **Statistiques** : Tableau de bord avec métriques en temps réel
- **Interface moderne** : Design Bootstrap 5 avec interface responsive

## 📋 Prérequis

- Node.js 18+
- PostgreSQL (locale ou cloud)
- Compte Render.com (pour le déploiement)

## 🔧 Installation

1. **Cloner le repository**
   ```bash
   git clone <repository-url>
   cd admin-interface
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration des variables d'environnement**
   ```bash
   cp env.example .env
   # Modifier le fichier .env avec vos paramètres
   ```

4. **Démarrer le serveur**
   ```bash
   npm start
   ```

L'interface sera disponible sur `http://localhost:3001`

## 🌐 Déploiement

Consultez le fichier `DEPLOYMENT.md` pour les instructions détaillées de déploiement sur Render.

## 📁 Structure du Projet

```
admin-interface/
├── admin-public/          # Interface web (HTML, CSS, JS)
├── admin-server.js        # Serveur Express principal
├── database.js           # Configuration et fonctions PostgreSQL
├── package.json          # Dépendances Node.js
├── render.yaml           # Configuration Render
├── env.example           # Variables d'environnement
├── DEPLOYMENT.md         # Guide de déploiement
└── README.md            # Ce fichier
```

## 🔗 API Endpoints

### Dashboard
- `GET /api/dashboard` - Statistiques et données récentes

### Licences
- `GET /api/licenses` - Liste des licences
- `POST /api/licenses` - Créer une licence
- `DELETE /api/licenses/:id` - Supprimer une licence

### Machines
- `GET /api/machines` - Liste des machines
- `POST /api/machines/register` - Enregistrer une machine
- `POST /api/machines/:id/reset-trial` - Réinitialiser en période d'essai

### Paramètres
- `GET /api/settings` - Récupérer les paramètres
- `POST /api/settings` - Modifier les paramètres

### Validation
- `POST /api/validate-license` - Valider une licence

## 🔒 Sécurité

- Chiffrement AES-256 pour les clés de licence
- Validation des machines par ID unique
- Protection CORS configurable
- Variables d'environnement pour les secrets

## 📊 Base de Données

Le système utilise PostgreSQL avec les tables suivantes :
- `licenses` - Stockage des licences
- `machines` - Enregistrement des machines
- `settings` - Paramètres système

## 🛠️ Développement

```bash
# Mode développement avec auto-reload
npm run dev

# Tests (à implémenter)
npm test
```

## 📝 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

---

**🎉 Interface admin prête pour la production !** 