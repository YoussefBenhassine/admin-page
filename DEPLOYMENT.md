# 🚀 Guide de Déploiement - Email Campaign Manager Admin

## 📋 Prérequis

- Compte [Render.com](https://render.com) (gratuit)
- Compte GitHub/GitLab pour le repository
- Node.js 18+ installé localement

## 🔧 Configuration Locale

### 1. Installation des dépendances

```bash
npm install
```

### 2. Configuration des variables d'environnement

Copiez le fichier `env.example` vers `.env` :

```bash
cp env.example .env
```

Modifiez le fichier `.env` avec vos paramètres :

```env
# Configuration du serveur
PORT=3001
NODE_ENV=development

# Configuration PostgreSQL locale (optionnel)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=email_campaign_admin
DB_USER=postgres
DB_PASSWORD=your_password

# Clé secrète pour le chiffrement des licences
ENCRYPTION_KEY=your_super_secret_encryption_key_here

# Configuration CORS
CORS_ORIGIN=*
```

### 3. Test local

```bash
npm start
```

L'interface admin sera disponible sur `http://localhost:3001`

## 🌐 Déploiement sur Render

### 1. Préparation du Repository

1. Créez un repository Git si ce n'est pas déjà fait
2. Poussez votre code vers le repository

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Configuration Render

#### Option A : Déploiement Automatique (Recommandé)

1. Connectez-vous à [Render.com](https://render.com)
2. Cliquez sur "New +" → "Blueprint"
3. Connectez votre repository GitHub/GitLab
4. Render détectera automatiquement le fichier `render.yaml`
5. Cliquez sur "Apply"

#### Option B : Déploiement Manuel

1. Connectez-vous à [Render.com](https://render.com)
2. Cliquez sur "New +" → "Web Service"
3. Connectez votre repository
4. Configurez le service :
   - **Name** : `email-campaign-admin`
   - **Environment** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : `Free`

### 3. Configuration de la Base de Données PostgreSQL

1. Dans votre dashboard Render, cliquez sur "New +" → "PostgreSQL"
2. Configurez la base de données :
   - **Name** : `email-campaign-db`
   - **Database** : `email_campaign_admin`
   - **User** : `email_campaign_user`
   - **Plan** : `Free`

### 4. Variables d'Environnement

Dans votre service web Render, ajoutez ces variables d'environnement :

| Variable | Valeur | Description |
|----------|--------|-------------|
| `NODE_ENV` | `production` | Mode de production |
| `PORT` | `10000` | Port du serveur |
| `CORS_ORIGIN` | `*` | Configuration CORS |
| `ENCRYPTION_KEY` | `[généré automatiquement]` | Clé de chiffrement |
| `DATABASE_URL` | `[URL de la DB Render]` | URL de connexion PostgreSQL |

### 5. Déploiement

1. Cliquez sur "Create Web Service"
2. Render va automatiquement :
   - Installer les dépendances
   - Créer les tables PostgreSQL
   - Migrer les données existantes
   - Démarrer le serveur

## 🔗 Configuration de l'Application Electron

### 1. Mise à jour de l'URL du serveur

Dans votre application Electron, mettez à jour l'URL du serveur admin :

```javascript
// Dans src/hooks/useLicense.js
const ADMIN_SERVER_URL = 'https://your-app-name.onrender.com';
```

### 2. Test de connexion

1. Démarrez votre application Electron
2. Vérifiez que la connexion au serveur admin fonctionne
3. Testez la création et validation de licences

## 📊 Monitoring et Logs

### Logs Render

- Accédez aux logs via le dashboard Render
- Surveillez les erreurs de connexion à la base de données
- Vérifiez les performances

### Base de Données

- Utilisez l'interface PostgreSQL de Render pour inspecter les données
- Surveillez l'espace disque utilisé
- Vérifiez les connexions actives

## 🔒 Sécurité

### Variables d'Environnement

- Ne committez jamais le fichier `.env`
- Utilisez des clés de chiffrement fortes en production
- Limitez l'accès CORS si nécessaire

### Base de Données

- La base de données Render est automatiquement sécurisée
- Les connexions utilisent SSL
- Les sauvegardes sont automatiques

## 🚨 Dépannage

### Erreurs Courantes

1. **Erreur de connexion à la base de données**
   - Vérifiez la variable `DATABASE_URL`
   - Assurez-vous que la base de données est créée

2. **Erreur de port**
   - Render utilise le port 10000 par défaut
   - Vérifiez la variable `PORT`

3. **Erreur de migration**
   - Les tables sont créées automatiquement
   - Vérifiez les logs pour plus de détails

### Support

- Consultez les [logs Render](https://render.com/docs/logs)
- Vérifiez la [documentation PostgreSQL](https://render.com/docs/databases)
- Contactez le support Render si nécessaire

## 📈 Évolutivité

### Upgrade du Plan

- Passez au plan "Starter" pour plus de ressources
- Ajoutez des instances multiples pour la haute disponibilité
- Configurez un CDN pour les performances

### Sauvegarde

- Les sauvegardes PostgreSQL sont automatiques
- Exportez régulièrement vos données
- Testez la restauration

## ✅ Checklist de Déploiement

- [ ] Repository Git configuré
- [ ] Fichier `render.yaml` créé
- [ ] Base de données PostgreSQL créée
- [ ] Variables d'environnement configurées
- [ ] Service web déployé
- [ ] Migration des données effectuée
- [ ] Application Electron mise à jour
- [ ] Tests de connexion réussis
- [ ] Logs surveillés
- [ ] Documentation mise à jour

---

**🎉 Félicitations !** Votre serveur admin est maintenant déployé sur Render avec PostgreSQL ! 