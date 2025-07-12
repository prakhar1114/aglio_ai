# Dashboard Architecture - Split Design Documentation

## Overview

The admin dashboard has been completely redesigned and split from a monolithic `dashboard.js` file into a modular, maintainable architecture. This split provides better organization, separation of concerns, and easier maintenance.

## Architecture Split

### 1. **dashboard-core.js** (24KB)
**Purpose:** Central management and WebSocket communication
**Key Responsibilities:**
- WebSocket connection management and reconnection logic
- Authentication and session management
- Connection status indicators
- Core event handling and message routing
- Global dashboard state management

**Key Classes:**
- `DashboardManager` - Main orchestrator class

**Key Features:**
- Automatic reconnection with exponential backoff
- Connection status visual indicators
- JWT token management
- Restaurant slug storage and validation
- Global toast notifications
- QR code generation for tables

### 2. **dashboard-menu.js** (7KB)
**Purpose:** Menu data management and search functionality
**Key Responsibilities:**
- Menu fetching from `/restaurants/{restaurant_slug}/menu/`
- LocalStorage caching with 30-minute expiry
- Fuse.js integration for intelligent search
- Menu data validation and refresh logic

**Key Classes:**
- `DashboardMenuManager` - Menu operations handler

**Key Features:**
- Smart caching with expiry and restaurant validation
- Weighted fuzzy search (name: 0.4, description: 0.3, category: 0.2, group: 0.1)
- Auto-suggestions with debounced search
- Menu data persistence and cache invalidation

### 3. **dashboard-orders.js** (15KB)
**Purpose:** Order editing and management
**Key Responsibilities:**
- Order editing modal rendering and management
- Current order items display and manipulation
- Menu item search and addition interface
- WebSocket integration for order updates

**Key Classes:**
- `DashboardOrderManager` - Order operations handler

**Key Features:**
- Complete order editing interface
- Real-time item quantity management
- Item removal with confirmation
- Menu search with instant results
- Order total calculation and display
- WebSocket `edit_order` action integration

### 4. **dashboard-customization.js** (18KB)
**Purpose:** Item customization and variations/addons management
**Key Responsibilities:**
- Item customization modal (redesigned and centered)
- Variation selection logic
- Addon management with quantity controls
- Price calculation with variations and addons
- Special instructions handling

**Key Classes:**
- `DashboardCustomizationManager` - Customization operations handler

**Key Features:**
- **Centered Modal Design:** Fixed positioning with proper viewport centering
- **Compact Layout:** Space-efficient design with 480px max width
- **Intuitive Controls:** Clear quantity controls and selection interface
- **Real-time Pricing:** Dynamic price calculation with variations/addons
- **Responsive Design:** Mobile-optimized with adaptive sizing

### 5. **dashboard-ui.js** (19KB)
**Purpose:** UI rendering and table management
**Key Responsibilities:**
- Table grid rendering and updates
- Waiter request display and management
- Event handling for table actions
- Visual state management for tables

**Key Classes:**
- `DashboardUIManager` - UI rendering and interactions

**Key Features:**
- Real-time table grid updates
- Color-coded table states (open, occupied, dirty, disabled)
- Waiter request notifications
- Table action handling (move, close, clean, disable)

## Design Principles

### 1. **Separation of Concerns**
Each file has a single, well-defined responsibility:
- Core handles connections and coordination
- Menu manages data and search
- Orders handles editing operations
- Customization manages item variations
- UI manages rendering and interactions

### 2. **Dependency Injection**
All managers are injected with the main dashboard instance:
```javascript
// In dashboard-core.js
this.menuManager = new DashboardMenuManager(this);
this.orderManager = new DashboardOrderManager(this);
this.customizationManager = new DashboardCustomizationManager(this);
this.uiManager = new DashboardUIManager(this);
```

### 3. **Event-Driven Architecture**
Components communicate through events and callbacks:
- WebSocket messages are routed to appropriate handlers
- UI events trigger business logic in respective managers
- State changes propagate through the system

### 4. **Caching Strategy**
Intelligent caching with validation:
- Menu data cached for 30 minutes
- Restaurant-specific cache keys
- Automatic cache invalidation on restaurant change
- Fallback to API on cache miss

### 5. **Error Handling**
Comprehensive error handling at each level:
- Connection failure recovery
- API error handling with user feedback
- Graceful degradation for missing data
- Toast notifications for user feedback

## Data Flow

### 1. **Initialization Flow**
```
Dashboard Load → Core Init → Manager Creation → WebSocket Connection → UI Rendering
```

### 2. **Order Editing Flow**
```
Edit Button Click → Order Manager → Menu Manager (search) → Customization Manager → WebSocket Update
```

### 3. **Menu Search Flow**
```
Search Input → Menu Manager → Fuse.js Search → Results Display → Item Selection
```

### 4. **WebSocket Message Flow**
```
WebSocket Message → Core Handler → Route to Manager → Update UI → User Feedback
```

## Performance Optimizations

### 1. **Lazy Loading**
- Modular file loading prevents initial bundle bloat
- Managers initialize only when needed
- Menu data loaded on-demand

### 2. **Caching Strategy**
- LocalStorage for menu data persistence
- 30-minute expiry prevents stale data
- Restaurant-specific cache keys

### 3. **Debounced Search**
- Search requests debounced to prevent API spam
- Fuse.js provides client-side search performance
- Results cached and reused

### 4. **Efficient DOM Updates**
- Targeted DOM updates instead of full re-renders
- Event delegation for table actions
- Minimal DOM manipulation

## Mobile Responsiveness

### 1. **Adaptive Modal Design**
- Customization modal scales to viewport
- Touch-friendly controls (32px+ touch targets)
- Responsive padding and margins

### 2. **Flexible Grid Layout**
- Table grid adapts to screen size
- Sidebar collapses on mobile
- Optimized for touch interactions

### 3. **Optimized Typography**
- Readable font sizes across devices
- Sufficient contrast ratios
- Scalable UI elements

## Security Considerations

### 1. **Authentication**
- JWT token validation for all operations
- Restaurant-specific access control
- Secure WebSocket connections

### 2. **Data Validation**
- Input sanitization for all user inputs
- API response validation
- XSS prevention in dynamic content

### 3. **Error Information**
- Non-sensitive error messages
- Logging for debugging without exposing internals
- Graceful handling of invalid data

## Future Extensibility

### 1. **Plugin Architecture**
- Easy to add new managers
- Modular functionality
- Independent testing and maintenance

### 2. **API Integration**
- RESTful API design
- WebSocket real-time updates
- Easy to add new endpoints

### 3. **UI Flexibility**
- Component-based UI architecture
- Easy theming and customization
- Responsive design patterns

## File Loading Order

The files must be loaded in this specific order in the HTML:
```html
<script src="/admin/static/dashboard-core.js"></script>
<script src="/admin/static/dashboard-menu.js"></script>
<script src="/admin/static/dashboard-orders.js"></script>
<script src="/admin/static/dashboard-customization.js"></script>
<script src="/admin/static/dashboard-ui.js"></script>
```

This ensures proper dependency resolution and initialization sequence.

## Benefits of This Architecture

1. **Maintainability:** Each file has a single responsibility
2. **Testability:** Isolated components can be tested independently
3. **Scalability:** Easy to add new features without affecting existing code
4. **Performance:** Modular loading and caching strategies
5. **Readability:** Clear separation of concerns and documented interfaces
6. **Collaboration:** Multiple developers can work on different modules simultaneously

This architecture provides a solid foundation for future enhancements while maintaining the existing functionality and improving the overall user experience. 