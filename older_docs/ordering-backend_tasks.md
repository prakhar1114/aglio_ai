# Backend Tasks - Auto Ordering System

## Phase 1: Database Foundation

### Task 1.1: Postgres Schema Implementation
- **File**: `backend/models/ordering.py`
- **Goal**: Implement the complete database schema for auto-ordering
- **Tables to create**:
  - `restaurants` (id, slug, name, opens_at, closes_at)
  - `tables` (id, restaurant_id, number, qr_token)
  - `sessions` (id, restaurant_id, table_id, state, manual_closed, daily_pass_required, pass_validated, created_at, last_activity_at)
  - `members` (id, session_id, nickname, is_host)
  - `cart_items` (id, session_id, member_id, menu_item_id, qty, note, version)
  - `orders` (id, session_id, pos_ticket, cart_hash, created_at)
  - `events` (id, session_id, kind, payload, created_at)
- **Dependencies**: None
- **Estimate**: 4 hours

### Task 1.2: Database Migrations & Indexes
- **File**: `backend/migrations/`
- **Goal**: Create Alembic migrations and performance indexes
- **Indexes needed**:
  - `sessions (restaurant_id, state)`
  - `cart_items (session_id)`
  - `events (session_id, created_at DESC)`
  - Unique constraint on `sessions (table_id) WHERE state='active'`
- **Dependencies**: Task 1.1
- **Estimate**: 2 hours

### Task 1.3: Redis Configuration & Key Schema
- **File**: `backend/config.py`, `backend/utils/redis_client.py`
- **Goal**: Set up Redis with proper key patterns
- **Key patterns to implement**:
  - `sess:{sid}` → session metadata (3h TTL)
  - `cart:{sid}` → cart snapshot (10 min TTL, reset on write)
  - `jwt:{jti}` → token blacklist
  - `passOK:{sid}` → daily pass validation (3h TTL)
  - `retry:pos` → Redis Stream for POS retry queue
  - `ratelimit:{ip}` → IP rate limiting (60s TTL)
- **Dependencies**: None
- **Estimate**: 3 hours

## Phase 2: Core Session Management APIs

### Task 2.1: Restaurant Status & Opening Hours
- **File**: `backend/urls/session.py`
- **Goal**: Implement `/is_open` endpoint
- **Features**:
  - Check if restaurant is open based on current time
  - Validate table exists and is enabled
  - Return appropriate error codes (403 for closed, 423 for disabled table)
- **Request**: `GET /is_open?restaurant_name=chianti&table_number=7`
- **Dependencies**: Task 1.1
- **Estimate**: 2 hours

### Task 2.2: Table Session Creation & Management
- **File**: `backend/urls/session.py`
- **Goal**: Implement session creation and lookup logic
- **Endpoints**:
  - `POST /table_session` - Create or join existing session
  - `GET /table_session_details` - Get session info and members
  - `PATCH /session/{id}/close` - Staff close session
  - `PATCH /session/{id}/restore` - Staff restore session
- **Features**:
  - Handle race conditions with ON CONFLICT
  - Support force=True for new session creation
  - Return JWT `ws_token` for WebSocket auth
- **Dependencies**: Task 2.1, Task 1.3
- **Estimate**: 5 hours

### Task 2.3: Member Management
- **File**: `backend/urls/members.py`
- **Goal**: Handle member join/leave and nickname changes
- **Endpoints**:
  - `POST /member` - Join session with nickname
  - `PUT /member/{id}` - Update nickname
- **Features**:
  - Auto-generate random nicknames if none provided
  - Broadcast member events via WebSocket
  - Track member activity for session timeout
- **Dependencies**: Task 2.2
- **Estimate**: 3 hours

## Phase 3: WebSocket Server Implementation

### Task 3.1: WebSocket Authentication Middleware
- **File**: `backend/websocket/auth.py`
- **Goal**: JWT-based WebSocket authentication
- **Features**:
  - Validate `ws_token` from Authorization header
  - Extract session_id and member_id from JWT claims
  - Handle token expiry and refresh logic
  - Close connection with proper error codes on auth failure
- **Dependencies**: Task 1.3, Task 2.2
- **Estimate**: 4 hours

### Task 3.2: WebSocket Connection Manager
- **File**: `backend/websocket/manager.py`
- **Goal**: Manage WebSocket connections and broadcasting
- **Features**:
  - Connection pool grouped by session_id
  - Broadcast to specific session members
  - Handle connection cleanup on disconnect
  - Connection health checks and heartbeat
- **Dependencies**: Task 3.1
- **Estimate**: 4 hours

### Task 3.3: Real-time Event Broadcasting
- **File**: `backend/websocket/events.py`
- **Goal**: Implement event system for real-time updates
- **Events to support**:
  - `member_join` - New member joins session
  - `cart_update` - Cart item changes
  - `order_fired` - Order sent to POS
  - `session_closed` - Session ended
- **Dependencies**: Task 3.2
- **Estimate**: 3 hours

## Phase 4: Cart Management System

### Task 4.1: Real-time Cart Operations
- **File**: `backend/urls/cart.py`
- **Goal**: Handle cart mutations via WebSocket
- **WebSocket message types**:
  - `cart_mutate` - Create/update/delete cart items
  - Handle optimistic concurrency with version numbers
  - Broadcast changes to all session members
  - Validate member permissions (only edit own items)
- **Dependencies**: Task 3.3, Task 2.3
- **Estimate**: 6 hours

### Task 4.2: Cart Snapshot API
- **File**: `backend/urls/cart.py`
- **Goal**: Implement cart state recovery
- **Endpoint**: `GET /cart_snapshot?sessionId=abc123`
- **Features**:
  - Return complete cart state with members
  - Include cart version hash for conflict detection
  - Cache snapshots in Redis for performance
- **Dependencies**: Task 4.1
- **Estimate**: 3 hours

### Task 4.3: Concurrency Control & Conflict Resolution
- **File**: `backend/utils/cart_conflicts.py`
- **Goal**: Handle concurrent cart modifications
- **Features**:
  - Version-based optimistic locking
  - Conflict detection and resolution strategies
  - Return current state on version conflicts
  - Atomic cart operations using database transactions
- **Dependencies**: Task 4.1
- **Estimate**: 4 hours

## Phase 5: Order Processing & POS Integration

### Task 5.1: Daily Pass System
- **File**: `backend/urls/auth.py`
- **Goal**: Implement daily password validation
- **Endpoints**:
  - `POST /session/{id}/validate_pass` - Validate daily password
  - `POST /admin/daily_pass` - Generate new daily password (staff)
- **Features**:
  - Hash-based password storage
  - Automatic daily rotation via cron job
  - Email notification to restaurant owner
  - Block cart operations until validated
- **Dependencies**: Task 2.2
- **Estimate**: 4 hours

### Task 5.2: Order Placement & Cart Hash Validation
- **File**: `backend/urls/orders.py`
- **Goal**: Handle order placement with idempotency
- **Endpoint**: `POST /orders`
- **Features**:
  - Calculate and validate cart hash
  - Prevent duplicate orders with same hash
  - Generate unique order ID and POS ticket number
  - Store order audit trail
- **Dependencies**: Task 4.2, Task 5.1
- **Estimate**: 4 hours

### Task 5.3: POS Integration & Retry Logic
- **File**: `backend/integrations/pos.py`
- **Goal**: Send orders to POS with reliability
- **Features**:
  - HTTP POST to POS endpoint with order data
  - 3-second timeout with retry queue on failure
  - Redis Stream for retry job management
  - Exponential backoff for failed attempts
  - Staff notification on persistent failures
- **Dependencies**: Task 5.2, Task 1.3
- **Estimate**: 5 hours

## Phase 6: Background Jobs & Automation

### Task 6.1: Session Auto-Expiry Worker
- **File**: `backend/workers/session_cleanup.py`
- **Goal**: Automatically close stale sessions
- **Features**:
  - Runs every 5 minutes via cron
  - Close sessions idle for >90 minutes
  - Close paid sessions idle for >10 minutes
  - Broadcast session_closed events
  - Update Redis cache
- **Dependencies**: Task 3.3, Task 2.2
- **Estimate**: 3 hours

### Task 6.2: POS Retry Worker
- **File**: `backend/workers/pos_retry.py`
- **Goal**: Process failed POS orders from retry queue
- **Features**:
  - Consume from Redis Stream `retry:pos`
  - Exponential backoff (30s, 2m, 8m, 32m)
  - Alert staff after 5 failed attempts
  - Acknowledge successful deliveries
- **Dependencies**: Task 5.3
- **Estimate**: 4 hours

### Task 6.3: Nightly Cleanup Jobs
- **File**: `backend/workers/nightly_cleanup.py`
- **Goal**: Clean up old data and regenerate daily passes
- **Jobs**:
  - Delete sessions closed >24 hours ago
  - Purge old events and cart snapshots
  - Generate new daily pass (if enabled)
  - Clean up expired JWT tokens from blacklist
- **Dependencies**: Task 5.1, Task 6.1
- **Estimate**: 3 hours

## Phase 7: Staff Dashboard APIs

### Task 7.1: Table Status Dashboard
- **File**: `backend/urls/admin.py`
- **Goal**: Real-time table status for staff
- **Endpoints**:
  - `GET /admin/tables` - List all tables with current status
  - `GET /admin/sessions/active` - Active sessions with timers
  - `WebSocket /admin/ws` - Real-time updates for staff
- **Features**:
  - Show session duration and member count
  - Display unpaid orders and amounts
  - POS integration status indicators
- **Dependencies**: Task 3.2, Task 5.2
- **Estimate**: 4 hours

### Task 7.2: Staff Control Actions
- **File**: `backend/urls/admin.py`
- **Goal**: Staff controls for table management
- **Endpoints**:
  - `POST /admin/table/{id}/disable` - Emergency table disable
  - `POST /admin/session/{id}/force_close` - Force close session
  - `POST /admin/system/disable_ordering` - Global ordering kill switch
- **Features**:
  - Immediate WebSocket notifications
  - Audit log for all staff actions
  - Permission-based access control
- **Dependencies**: Task 7.1
- **Estimate**: 3 hours

## Phase 8: Security & Performance

### Task 8.1: Rate Limiting & Security
- **File**: `backend/middleware/security.py`
- **Goal**: Protect against abuse and attacks
- **Features**:
  - IP-based rate limiting (5 requests/min per endpoint)
  - HMAC-signed QR tokens with expiry
  - Input validation and sanitization
  - SQL injection prevention
- **Dependencies**: Task 1.3
- **Estimate**: 4 hours

### Task 8.2: Performance Monitoring
- **File**: `backend/monitoring/metrics.py`
- **Goal**: Monitor system health and performance
- **Metrics**:
  - WebSocket connection counts
  - Cart operation latency
  - POS integration success rate
  - Session creation/closure rates
- **Dependencies**: All previous tasks
- **Estimate**: 3 hours

### Task 8.3: Error Handling & Logging
- **File**: `backend/utils/error_handling.py`
- **Goal**: Comprehensive error handling and logging
- **Features**:
  - Structured logging with correlation IDs
  - Error categorization and alerting
  - Graceful degradation strategies
  - Client-friendly error messages
- **Dependencies**: All previous tasks
- **Estimate**: 3 hours

## Phase 9: Testing & Documentation

### Task 9.1: Unit Tests
- **Files**: `backend/tests/`
- **Goal**: Comprehensive test coverage
- **Test categories**:
  - Database model tests
  - API endpoint tests  
  - WebSocket event tests
  - POS integration tests
- **Target**: 85%+ code coverage
- **Dependencies**: All previous tasks
- **Estimate**: 8 hours

### Task 9.2: Integration Tests
- **Files**: `backend/tests/integration/`
- **Goal**: End-to-end workflow testing
- **Test scenarios**:
  - Complete ordering flow (QR scan to POS)
  - Multi-user cart collaboration
  - Session expiry and cleanup
  - POS failure and retry scenarios
- **Dependencies**: All previous tasks
- **Estimate**: 6 hours

### Task 9.3: API Documentation
- **File**: `backend/docs/api.md`
- **Goal**: Complete API documentation
- **Features**:
  - OpenAPI/Swagger specification
  - WebSocket event documentation
  - Error code reference
  - Integration examples
- **Dependencies**: All previous tasks
- **Estimate**: 4 hours

## Phase 10: Deployment & DevOps

### Task 10.1: Docker Configuration
- **Files**: `Dockerfile`, `docker-compose.yml`
- **Goal**: Containerized deployment setup
- **Services**:
  - FastAPI application
  - Postgres database
  - Redis cache
  - Background workers
- **Dependencies**: All previous tasks
- **Estimate**: 3 hours

### Task 10.2: Environment Configuration
- **File**: `backend/config/environments.py`
- **Goal**: Multi-environment configuration
- **Environments**: Development, staging, production
- **Features**:
  - Environment-specific database URLs
  - Feature flags for A/B testing
  - Secrets management
- **Dependencies**: Task 10.1
- **Estimate**: 2 hours

### Task 10.3: Health Checks & Monitoring
- **File**: `backend/health.py`
- **Goal**: Production readiness checks
- **Endpoints**:
  - `/health` - Basic health check
  - `/health/detailed` - Database, Redis, POS connectivity
  - `/metrics` - Prometheus metrics endpoint
- **Dependencies**: Task 10.2
- **Estimate**: 2 hours

---

## Total Estimated Time: ~90 hours

## Priority Order:
1. **Phase 1**: Database foundation (9 hours)
2. **Phase 2**: Core session APIs (10 hours)
3. **Phase 3**: WebSocket server (11 hours)
4. **Phase 4**: Cart management (13 hours)
5. **Phase 5**: Order processing (13 hours)
6. **Phase 6**: Background jobs (10 hours)
7. **Phase 7**: Staff dashboard (7 hours)
8. **Phase 8**: Security & performance (10 hours)
9. **Phase 9**: Testing & docs (18 hours)
10. **Phase 10**: Deployment (7 hours)

## Critical Path Dependencies:
- **Database schema** must be completed before any API work
- **WebSocket authentication** enables real-time features
- **Cart management** depends on WebSocket infrastructure
- **POS integration** is required for order completion
- **Background workers** ensure system reliability

Each task includes specific deliverables and acceptance criteria for clear progress tracking. 