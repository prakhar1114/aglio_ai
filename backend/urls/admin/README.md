# Admin Dashboard

A web-based admin interface for managing restaurant tables in real-time.

## Features

- **API Key Authentication**: Secure login using restaurant-specific API keys
- **Real-time Table Grid**: Live view of all tables with automatic updates every 10 seconds
- **Table Management**: Close sessions, disable/enable tables, move parties, and clean tables
- **Visual Status Indicators**: Color-coded table states (open, occupied, dirty, disabled)
- **Toast Notifications**: Real-time feedback for all actions
- **Move Functionality**: Drag-and-drop style table movement with visual guides

## Getting Started

### 1. Setup Test Data

```bash
cd backend
python scripts/setup_admin_test_data.py
```

This will create a test restaurant with 12 tables in various states and output the API key.

### 2. Start the Server

```bash
cd backend
python main.py
```

### 3. Access the Dashboard

Navigate to: `http://localhost:8005/admin/login`

Use the API key from step 1 to log in.

## API Endpoints

### Web Interface
- `GET /admin/login` - Login page
- `POST /admin/login` - Handle login form
- `GET /admin/dashboard` - Dashboard page
- `GET /admin/tables` - Table grid HTML (for HTMX updates)

### Actions
- `POST /admin/table/{id}/close` - Close active session, mark table dirty
- `POST /admin/table/{id}/disable` - Disable table (only when free)
- `POST /admin/table/{id}/enable` - Enable disabled table or clean dirty table
- `POST /admin/table/{id}/move` - Move party to another table

### JSON API
- `GET /admin/api/tables` - Get table data as JSON

## Table States

| State | Color | Description |
|-------|-------|-------------|
| **Open** | Green | Available for new customers |
| **Occupied** | Blue | Has active dining session |
| **Dirty** | Yellow | Needs cleaning after customers left |
| **Disabled** | Gray | Temporarily unavailable |

## Authentication

The dashboard uses API key authentication:
1. Each restaurant has a unique 12-character API key
2. Keys are stored in the `restaurants` table
3. Authentication uses Bearer tokens in API requests
4. Web interface stores keys in session storage

## Technology Stack

- **Backend**: FastAPI with Jinja2 templates
- **Frontend**: HTMX for real-time updates, vanilla JavaScript
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Styling**: Modern CSS with gradients and animations

## File Structure

```
backend/urls/admin/
├── __init__.py
├── auth_utils.py          # Authentication utilities
├── dashboard.py           # Main dashboard endpoints
├── templates/
│   └── admin/
│       ├── login.html     # Login page
│       ├── dashboard.html # Main dashboard
│       └── partials/
│           └── grid.html  # Table grid partial
└── static/
    ├── dashboard.css      # Dashboard styles
    └── dashboard.js       # Dashboard JavaScript
```

## Development

### Adding New Actions

1. Add endpoint in `dashboard.py`
2. Update `grid.html` template with new button
3. Add CSS styles if needed
4. Update error handling in `dashboard.js`

### Customizing Appearance

- Modify `dashboard.css` for styling changes
- Update color schemes in CSS variables
- Adjust grid layout and responsive breakpoints

## Security Notes

- API keys are transmitted over HTTPS in production
- Keys are hashed and compared using timing-safe methods
- Session storage is cleared on logout
- Invalid authentication results in redirect to login 