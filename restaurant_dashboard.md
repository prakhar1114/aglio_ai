# Restaurant Admin Dashboard

## Overview

The Restaurant Admin Dashboard is a FastAPI-based web interface that allows restaurant staff to monitor and manage table sessions across multiple restaurants. It provides real-time visibility into table statuses and allows administrative control over table availability.

## Architecture

### Core Components

1. **Admin API Layer** (`backend/urls/admin/`)
   - Restaurant management endpoints
   - Table status monitoring and control
   - Dashboard UI serving

2. **Redis Session Storage**
   - Stores active table sessions
   - Maintains session history for audit purposes
   - Supports multiple restaurants via tenant isolation

3. **Configuration Files**
   - `restaurant_settings.json`: Restaurant-specific settings (table count, passwords)
   - `restaurant_onboarding.json`: Restaurant metadata and configurations

### Folder Structure

```
backend/urls/admin/
├── __init__.py              # Package initialization
├── dashboard.py             # Dashboard UI endpoints (HTML templates)
├── tables.py               # Table management API endpoints
└── restaurants.py          # Restaurant selection and info endpoints
```

## Table Status System

### Status Types

- **`available`**: No active session, table ready for new customers
- **`busy`**: Active customer session in progress (customers dining)
- **`disabled`**: Administratively disabled (maintenance/cleaning - staff controlled)
- **`expired`**: Session expired or timed out

### Status Determination Logic

1. Check if Redis session exists for table
2. If no session → `available`
3. If session exists:
   - Check `status` field in session data
   - Check TTL for expiration
   - Return appropriate status

### Color Coding (UI)

- 🟢 **Green**: Available tables (ready for customers)
- 🟡 **Yellow**: Busy tables (customers dining)
- 🔴 **Red**: Disabled tables (maintenance/cleaning)
- ⚫ **Gray**: Expired tables

### Business Flow

1. **available** ↔ **disabled** (staff maintenance control)
2. **available** → **busy** (customers arrive and create session)
3. **busy** → **available** (payment completed, customers leave)

## API Endpoints

### Restaurant Management

```http
GET /admin/restaurants
```
Returns list of all configured restaurants.

**Response:**
```json
{
  "restaurants": [
    {
      "id": "chianti",
      "name": "Chianti Restaurant",
      "table_count": 15,
      "active_tables": 3
    }
  ]
}
```

```http
GET /admin/restaurants/{restaurant_id}/info
```
Returns detailed information about a specific restaurant.

### Table Management

```http
GET /admin/restaurants/{restaurant_id}/tables
```
Returns status of all tables for a restaurant.

**Response:**
```json
{
  "restaurant_id": "chianti",
  "restaurant_name": "Chianti Restaurant",
  "tables": [
    {
      "table_number": 1,
      "status": "available",
      "session_id": null,
      "last_activity": null
    },
    {
      "table_number": 7,
      "status": "busy", 
      "session_id": "sess_abc123",
      "last_activity": "2024-01-15T10:30:00Z",
      "member_count": 2
    }
  ]
}
```

```http
GET /admin/restaurants/{restaurant_id}/tables/{table_number}/status
```
Returns detailed status of a specific table.

```http
POST /admin/restaurants/{restaurant_id}/tables/{table_number}/disable
```
Disable an available table for maintenance/cleaning.

**Request Body:**
```json
{
  "reason": "Maintenance required"
}
```

```http
POST /admin/restaurants/{restaurant_id}/tables/{table_number}/close
```
Close a busy table after payment is completed.

**Request Body:**
```json
{
  "reason": "Payment completed"
}
```

```http
POST /admin/restaurants/{restaurant_id}/tables/{table_number}/enable
```
Enable a disabled table (makes it available).

### Dashboard UI

```http
GET /admin/dashboard
```
Serves the main dashboard HTML interface.

```http
GET /admin/static/{file_path}
```
Serves static assets (CSS, JavaScript, images).

## Redis Data Structure

### Table Session Key Pattern
```
table_session:{tenant_id}:{table_number}
```

### Session Data Structure
```json
{
  "session_id": "sess_abc123def456",
  "table_number": 7,
  "table_name": "Table 7",
  "restaurant_name": "Chianti Restaurant",
  "tenant_id": "chianti",
  "status": "busy",
  "created_at": "2024-01-15T09:00:00Z",
  "last_activity": "2024-01-15T10:30:00Z",
  "members": [
    {
      "member_id": "member_abc123",
      "name": "CuteCat",
      "joined_at": "2024-01-15T09:00:00Z"
    }
  ],
  "admin_actions": [
    {
      "action": "closed",
      "timestamp": "2024-01-15T10:45:00Z",
      "admin_id": "staff_user",
      "reason": "Cleaning required"
    }
  ]
}
```

## Dashboard UI Features

### Restaurant Selection
- Dropdown to select active restaurant
- Shows restaurant name and table count
- Switches context for table grid

### Table Grid Display
- Visual grid layout showing all tables
- Color-coded status indicators
- Real-time status updates (polling every 30 seconds)

### Table Controls
- **Disable Table**: Disable available table for maintenance/cleaning
- **Close Table**: Complete payment for busy table (makes available)
- **Enable Table**: Re-enable disabled table (makes available)
- **View Details**: Shows session information and history

### Auto-refresh
- Automatic polling every 30 seconds
- Manual refresh button
- Last updated timestamp display

## Development Guide

### Adding New Features

1. **New API Endpoints**
   - Add to appropriate file in `/admin/` folder
   - Follow existing pattern with tenant_id parameter
   - Include proper error handling and logging

2. **UI Enhancements**
   - Modify `dashboard.html` template
   - Add JavaScript functions for new features
   - Update CSS for styling

3. **Status Types**
   - Add new status to table status logic
   - Update color coding in UI
   - Modify Redis data structure if needed

### Testing

1. **API Testing**
   ```bash
   # Get all restaurants
   curl http://localhost:8000/admin/restaurants
   
   # Get table statuses
   curl http://localhost:8000/admin/restaurants/chianti/tables
   
   # Close a table
   curl -X POST http://localhost:8000/admin/restaurants/chianti/tables/7/close \
        -H "Content-Type: application/json" \
        -d '{"reason": "Testing"}'
   ```

2. **Dashboard Testing**
   - Navigate to `http://localhost:8000/admin/dashboard`
   - Test restaurant selection
   - Test table status changes
   - Verify real-time updates

### Configuration

1. **Restaurant Settings**
   - Edit `restaurant_settings.json` to add/modify restaurants
   - Restart server after configuration changes

2. **Redis Configuration**
   - Sessions expire after 24 hours by default
   - Modify TTL in table management code if needed

## Future Enhancements

### Authentication & Authorization
- Role-based access control (admin, manager, staff)
- Session-based authentication
- API key management

### Advanced Features
- Analytics dashboard
- Order management integration
- Staff scheduling
- Menu management
- Customer feedback monitoring

### Performance Optimizations
- WebSocket real-time updates
- Redis clustering for high availability
- Caching strategies
- Database indexing

## Troubleshooting

### Common Issues

1. **Tables not showing**
   - Check restaurant configuration in `restaurant_settings.json`
   - Verify Redis connection
   - Check server logs for errors

2. **Status not updating**
   - Verify Redis key patterns
   - Check session data structure
   - Review table status logic

3. **Restaurant not found**
   - Ensure restaurant exists in configuration
   - Check tenant_id mapping
   - Verify restaurant onboarding data

### Debugging Commands

```bash
# Check Redis sessions
redis-cli keys "*table_session*"

# View session data
redis-cli get "table_session:chianti:7"

# Monitor Redis operations
redis-cli monitor
```

## Security Considerations

### Current State (No Authentication)
- All admin endpoints are publicly accessible
- No audit logging of admin actions
- No rate limiting on administrative operations

### Planned Security Features
- Admin user authentication
- Role-based permissions
- Action audit logging
- API rate limiting
- CSRF protection for web interface

## Maintenance

### Regular Tasks
- Monitor Redis memory usage
- Clean up expired sessions
- Review admin action logs
- Update restaurant configurations

### Backup & Recovery
- Redis persistence configuration
- Configuration file backups
- Session data export capabilities 