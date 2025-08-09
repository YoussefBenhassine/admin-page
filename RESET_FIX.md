# 🔧 Correction du Problème de Réinitialisation de Machine

## 🐛 Problème Identifié

L'erreur lors de la réinitialisation de la machine était causée par un appel incorrect à la fonction `db.updateLicense()` dans l'endpoint `/api/machines/:machineId/reset-trial`.

### Erreur Originale
```javascript
// ❌ Code problématique
await db.updateLicense(null, { machine_id: machineId, is_active: false });
```

**Problème :** La fonction `updateLicense()` nécessite un ID de licence valide (non null) et ne peut mettre à jour qu'une licence spécifique par son ID. Elle ne peut pas mettre à jour plusieurs licences par `machine_id`.

## ✅ Solution Implémentée

### 1. Nouvelles Fonctions de Base de Données

#### `updateLicensesByMachineId(machineId, updates)`
```javascript
async updateLicensesByMachineId(machineId, updates) {
  const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
  const values = Object.values(updates);
  const result = await pool.query(`
    UPDATE licenses 
    SET ${fields}, updated_at = CURRENT_TIMESTAMP
    WHERE machine_id = $1
    RETURNING *
  `, [machineId, ...values]);
  
  return result.rows;
}
```

#### `updateMachineLicenseKey(machineId, licenseKey = null)`
```javascript
async updateMachineLicenseKey(machineId, licenseKey = null) {
  const result = await pool.query(`
    UPDATE machines 
    SET license_key = $2, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE machine_id = $1
    RETURNING *
  `, [machineId, licenseKey]);
  
  return result.rows[0];
}
```

### 2. Endpoint Corrigé

```javascript
// ✅ Code corrigé
app.post('/api/machines/:machineId/reset-trial', async (req, res) => {
  try {
    const { machineId } = req.params;
    
    // Désactiver toutes les licences associées à cette machine
    await db.updateLicensesByMachineId(machineId, { is_active: false });
    
    // Supprimer la licence associée à la machine
    await db.updateMachineLicenseKey(machineId, null);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la machine:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la réinitialisation de la machine' });
  }
});
```

## 🔄 Processus de Réinitialisation

1. **Désactivation des Licences** : Toutes les licences associées à la machine sont marquées comme inactives (`is_active = false`)
2. **Suppression de la Licence Machine** : La référence à la licence dans la table `machines` est supprimée (`license_key = null`)
3. **Mise à Jour du Timestamp** : La machine est marquée comme vue récemment

## 🧪 Test de Validation

Un script de test a été créé (`test-reset.js`) pour valider le bon fonctionnement des nouvelles fonctions.

## 📋 Fichiers Modifiés

- `database.js` : Ajout des nouvelles fonctions de base de données
- `admin-server.js` : Correction de l'endpoint de réinitialisation
- `test-reset.js` : Script de test (nouveau fichier)
- `RESET_FIX.md` : Documentation de la correction (nouveau fichier)

## ✅ Résultat

La fonction de réinitialisation de machine fonctionne maintenant correctement :
- ✅ Désactive toutes les licences associées à la machine
- ✅ Supprime la référence de licence de la machine
- ✅ Met à jour les timestamps appropriés
- ✅ Retourne une réponse de succès

---

**Date de correction :** $(date)
**Statut :** ✅ Résolu 