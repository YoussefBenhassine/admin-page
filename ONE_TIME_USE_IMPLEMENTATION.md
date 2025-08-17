# 🔒 One-Time Use License Implementation

## 🎯 Overview

This implementation ensures that each license key can only be used **once** and becomes permanently bound to the **first machine** that uses it. Once a license is used, it becomes permanently invalid for any other machine.

## 🔧 Key Changes Made

### 1. **License Creation - Flexible Machine Binding**

**Universal Licenses (Recommended):**
```javascript
// Create license without machineId - becomes bound to first machine that uses it
machineId: machineId || null  // Allows universal licenses
```

**Machine-Specific Licenses:**
```javascript
// Create license with specific machineId - pre-bound to that machine
machineId: "specific-machine-id"  // Pre-bound to specific machine
```

### 2. **Enhanced License Validation with Auto-Binding**

**New Validation Logic:**
- ✅ License exists and is valid
- ✅ License is not expired
- ✅ License is active (not disabled)
- ✅ **NEW: Auto-bind universal licenses to first machine**
- ✅ License is authorized for the requesting machine
- ✅ License has not been used by this machine before
- ✅ **NEW: License has not been used by ANY machine before** (one-time use)

### 3. **Database Functions Added**

**New Functions:**
```javascript
async updateLicenseMachineId(licenseId, machineId) {
  const result = await pool.query(`
    UPDATE licenses 
    SET machine_id = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `, [licenseId, machineId]);
  return result.rows[0];
}

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

### **Auto-Binding Logic**
```javascript
// Si c'est la première utilisation et que la licence n'est pas liée à une machine spécifique,
// la lier à cette machine
if (!license.machine_id) {
  await db.updateLicenseMachineId(license.id, machineId);
} else if (license.machine_id !== machineId) {
  // Si la licence est déjà liée à une machine différente
  return res.json({ valid: false, error: 'Licence non autorisée pour cette machine' });
}
```

## 📋 API Endpoints

### **Create License** - `POST /api/licenses`
**Required Fields:**
- `expirationDate` (string) - License expiration date
- `machineId` (string) - **OPTIONAL** - Target machine ID (if not provided, becomes universal)

**Response:**
```json
{
  "success": true,
  "license": {
    "id": "uuid",
    "key": "encrypted-license-key",
    "expirationDate": "2024-12-31T00:00:00.000Z",
    "machineId": null,
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
1. ✅ Create universal license without machineId
2. ✅ First validation binds license to machine
3. ✅ Second validation on same machine fails
4. ✅ Validation on different machine fails
5. ✅ Create specific license with machineId
6. ✅ Specific license works on authorized machine
7. ✅ Specific license blocked on unauthorized machine

## 🔄 Workflow

### **Universal License Creation:**
1. Admin creates license without machineId
2. License is ready for any machine to use
3. First machine that validates becomes the owner

### **Machine-Specific License Creation:**
1. Admin creates license with specific machineId
2. License is pre-bound to that machine
3. Only that machine can use the license

### **License Validation:**
1. Client sends license key + machine ID
2. System checks all validation rules
3. If universal license, binds to first machine
4. If valid, license is marked as used
5. License becomes permanently invalid

### **Database Tracking:**
- `licenses` table: License details with `machine_id` (null initially for universal)
- `license_usage` table: Tracks which machines used which licenses
- `machines` table: Machine information and current license

## 🚫 What's Prevented

1. **Cross-Machine Usage**: License can't be used on different machines
2. **Reuse**: License can't be used multiple times
3. **Sharing**: License sharing between machines is impossible
4. **Transfer**: Once bound, license cannot be transferred

## 🔍 Monitoring

### **Admin Panel Features:**
- View license usage history
- See which machine each license is bound to
- Track license activation status
- Monitor failed validation attempts
- Distinguish between universal and specific licenses

### **Database Queries:**
```sql
-- Check license usage
SELECT * FROM license_usage WHERE license_id = 'xxx';

-- Get machine-specific licenses
SELECT * FROM licenses WHERE machine_id = 'xxx';

-- Get universal licenses (not yet used)
SELECT * FROM licenses WHERE machine_id IS NULL;

-- Count total usage
SELECT COUNT(*) FROM license_usage WHERE license_id = 'xxx';
```

## 🎯 Benefits

1. **Flexibility**: Can create universal or machine-specific licenses
2. **Security**: Each license is one-time use and machine-bound
3. **Prevention**: No license sharing or reuse possible
4. **Tracking**: Complete audit trail of license usage
5. **Compliance**: Meets strict licensing requirements
6. **Simplicity**: Clear, predictable behavior

## ⚠️ Important Notes

- **Permanent**: Once used, a license cannot be reactivated
- **Auto-Binding**: Universal licenses become machine-specific on first use
- **No Transfer**: Licenses cannot be transferred between machines
- **Admin Control**: Only admins can create new licenses
- **Electron Integration**: Perfect for Electron apps that generate their own machine IDs

## 🎯 Use Cases

### **Universal Licenses (Recommended for Electron Apps):**
- Admin creates license without machineId
- Electron app generates its own machineId
- First validation binds license to that machine
- Perfect for distributed software

### **Machine-Specific Licenses:**
- Admin creates license with specific machineId
- Pre-bound to known machine
- Useful for enterprise deployments

This implementation provides a robust, secure one-time use license system that's perfect for Electron applications while preventing any form of license sharing or reuse.
