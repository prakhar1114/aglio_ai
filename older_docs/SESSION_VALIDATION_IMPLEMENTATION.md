# Session Validation Implementation

This document outlines the implementation of session validation logic for restaurants that require daily passwords.

## Overview

The system now supports restaurants that require customers to enter a daily password before they can place orders or modify their cart. This feature allows restaurants to control access and ensure only authorized customers can place orders.

## Backend Changes

### 1. Updated Table Session API (`backend/urls/table_session.py`)

- Modified `POST /table_session` to return `session_validated` field
- Logic: 
  - If `restaurant.require_pass = false`: `session_validated = true`
  - If `restaurant.require_pass = true`: `session_validated = session.pass_validated`

### 2. New Password Validation API

- Added `POST /session/validate_pass` endpoint
- Validates daily password against `daily_passes` table
- Default password is "coffee" if no daily pass is set for today
- Updates `session.pass_validated = true` on successful validation

### 3. Database Schema

- Uses existing `restaurant.require_pass` field to determine if password is needed
- Uses existing `session.pass_validated` field to track validation status
- Uses existing `daily_passes` table for password management

### 4. Models Updated

- Added `ValidatePassRequest` and `ValidatePassResponse` models
- Updated `TableSessionResponse` to include `session_validated` field

## Frontend Changes

### 1. Session Store (`qrmenu/packages/core/src/store/session.js`)

- Added `sessionValidated` state field
- Updated persistence methods to save/load validation status
- Added helper methods:
  - `setSessionValidated(validated)`
  - `isPasswordRequired()`

### 2. API Layer (`qrmenu/packages/core/src/utils/connection.js`)

- Enhanced existing connection utilities
- Added method:
  - `validatePassword(sessionPid, word)` - validates daily password
- Existing methods:
  - `setupConnection(location)` - creates table session and WebSocket
  - `updateMemberNickname(memberPid, nickname)` - updates member info

### 3. UI Component (`qrmenu/packages/ui/src/components/PasswordValidationModal.jsx`)

- Modal component for password entry
- Handles password validation flow
- Shows success/error messages
- Includes hint about default "coffee" password

## Usage Flow

1. **Session Creation**: Customer scans QR code, gets session with `session_validated` status
2. **Password Check**: If `session_validated = false`, show password modal
3. **Validation**: Customer enters password, backend validates against daily_passes
4. **Access Granted**: On success, `session_validated = true`, cart operations allowed

## Default Behavior

- If restaurant has `require_pass = false`: No password needed, immediate access
- If restaurant has `require_pass = true` but no daily pass set: Default to "coffee"
- Password validation creates daily pass record if none exists for today

## Integration Points

The `PasswordValidationModal` should be integrated into the main app flow where:
- It appears when trying to add items to cart with `session_validated = false`
- It appears when trying to modify cart items with `session_validated = false`
- It can be triggered manually from UI if needed

## Error Handling

- Wrong password: Shows error message, allows retry
- Session closed: Redirects to session creation
- Network errors: Shows appropriate error messages
- Already validated: Graceful handling, no re-validation needed

## Security Considerations

- Passwords are hashed with SHA-256 before storage
- Validation status is tied to session, not device
- JWT tokens remain unchanged, validation is session-level
- Daily passwords are date-specific and restaurant-specific 