# 🔒 One-Time Use License Implementation

## 🎯 Overview

This implementation ensures that each license key can only be used **once** and only on the **specific machine** it was created for. Once a license is used, it becomes permanently invalid for any machine.

## 🔧 Key Changes Made

### 1. **License Creation - Machine Binding Required**

**Before:**
```javascript
machineId: machineId || null  // Could create universal licenses
```

**After:**
```javascript
// Require machineId to prevent universal licenses
if (!machineId) {
  return res.status(400).json({ success: false, error: 'ID machine requis pour créer une licence' });
}
machineId: machineId  // Always tied to specific machine
```

### 2. **Enhanced License Validation**

**New Validation Checks:**
- ✅ License exists and is valid
- ✅ License is not expired
- ✅ License is active (not disabled)
- ✅ License is authorized for the requesting machine
- ✅ License has not been used by this machine before
- ✅ **NEW: License has not been used by ANY machine before** (one-time use)

### 3. **Database Function Added**

**New Function:**
```javascript
async getLicenseUsageCount(licenseId) {
  const result = await pool.query(`
    SELECT COUNT(*) as count FROM license_usage 
    WHERE license_id = $1
  `, [licenseId]);
  return parseInt(result.rows[0].count);
}
```

## 🛡️ Security Features

### **One-Time Use Logic**
```javascript
// Vérifier si la licence a déjà été utilisée par une autre machine (one-time use global)
const usageCount = await db.getLicenseUsageCount(license.id);
if (usageCount > 0) {
  return res.json({ valid: false, error: 'Licence déjà utilisée sur une autre machine' });
}
```

### **Machine-Specific Binding**
```javascript
// Vérifier si la licence est pour une machine spécifique
if (license.machine_id && license.machine_id !== machineId) {
  return res.json({ valid: false, error: 'Licence non autorisée pour cette machine' });
}
```

## 📋 API Endpoints

### **Create License** - `POST /api/licenses`
**Required Fields:**
- `expirationDate` (string) - License expiration date
- `machineId` (string) - **REQUIRED** - Target machine ID

**Response:**
```json
{
  "success": true,
  "license": {
    "id": "uuid",
    "key": "encrypted-license-key",
    "expirationDate": "2024-12-31T00:00:00.000Z",
    "machineId": "specific-machine-id",
    "isActive": true,
    "usageCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### **Validate License** - `POST /api/validate-license`
**Required Fields:**
- `licenseKey` (string) - License key to validate
- `machineId` (string) - Machine requesting validation

**Success Response:**
```json
{
  "valid": true,
  "license": { /* license details */ }
}
```

**Error Responses:**
```json
{
  "valid": false,
  "error": "Clé de licence invalide"
}
{
  "valid": false,
  "error": "Licence expirée"
}
{
  "valid": false,
  "error": "Licence désactivée"
}
{
  "valid": false,
  "error": "Licence non autorisée pour cette machine"
}
{
  "valid": false,
  "error": "Licence déjà utilisée par cette machine"
}
{
  "valid": false,
  "error": "Licence déjà utilisée sur une autre machine"
}
```

## 🧪 Testing

Run the test script to verify the implementation:

```bash
node test-one-time-use.js
```

**Test Scenarios:**
1. ✅ Create license with required machineId
2. ✅ First validation succeeds
3. ✅ Second validation on same machine fails
4. ✅ Validation on different machine fails
5. ✅ Create license without machineId fails

## 🔄 Workflow

### **License Creation:**
1. Admin selects target machine
2. System creates license tied to that machine
3. License is ready for one-time use

### **License Validation:**
1. Client sends license key + machine ID
2. System checks all validation rules
3. If valid, license is marked as used
4. License becomes permanently invalid

### **Database Tracking:**
- `licenses` table: License details with `machine_id`
- `license_usage` table: Tracks which machines used which licenses
- `machines` table: Machine information and current license

## 🚫 What's Prevented

1. **Universal Licenses**: Can't create licenses without machine binding
2. **Cross-Machine Usage**: License can't be used on different machines
3. **Reuse**: License can't be used multiple times
4. **Sharing**: License sharing between machines is impossible

## 🔍 Monitoring

### **Admin Panel Features:**
- View license usage history
- See which machine each license is bound to
- Track license activation status
- Monitor failed validation attempts

### **Database Queries:**
```sql
-- Check license usage
SELECT * FROM license_usage WHERE license_id = 'xxx';

-- Get machine-specific licenses
SELECT * FROM licenses WHERE machine_id = 'xxx';

-- Count total usage
SELECT COUNT(*) FROM license_usage WHERE license_id = 'xxx';
```

## 🎯 Benefits

1. **Security**: Each license is machine-specific and one-time use
2. **Prevention**: No license sharing or reuse possible
3. **Tracking**: Complete audit trail of license usage
4. **Compliance**: Meets strict licensing requirements
5. **Simplicity**: Clear, predictable behavior

## ⚠️ Important Notes

- **Permanent**: Once used, a license cannot be reactivated
- **Machine-Specific**: Licenses are tied to specific machine IDs
- **No Transfer**: Licenses cannot be transferred between machines
- **Admin Control**: Only admins can create new licenses

This implementation provides a robust, secure one-time use license system that prevents any form of license sharing or reuse.
