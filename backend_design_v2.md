# Multi-Tenant Restaurant Backend Design Document

## 1. Executive Summary

This document outlines the architecture for a scalable multi-tenant restaurant recommendation and menu system. The backend supports multiple restaurants with complete data isolation while maintaining a single, maintainable codebase.

**Key Design Principles:**
- **Tenant Isolation**: Complete data separation between restaurants
- **Subdomain-based Routing**: Extract tenant from subdomain (chianti.aglioapp.com)
- **Shared Infrastructure**: Single backend serves all tenants
- **Scalable Onboarding**: Automated restaurant setup process

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer / CDN                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                FastAPI Application                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│  │ Tenant Resolver │ │ Auth Middleware │ │ Rate Limiter  │ │
│  └─────────────────┘ └─────────────────┘ └───────────────┘ │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐ │
│  │  Menu Service   │ │  Recommendation │ │ Session Mgmt  │ │
│  │                 │ │     Service     │ │               │ │
│  └─────────────────┘ └─────────────────┘ └───────────────┘ │
└─────────────────────┬───────────────────┬───────────────────┘
                      │                   │
        ┌─────────────▼───────────┐      ┌▼─────────────────┐
        │     Qdrant Vector DB    │      │   Redis Cache    │
        │                        │      │                  │
        │ ┌────────────────────┐ │      │ ┌──────────────┐ │
        │ │ chianti_dishes     │ │      │ │chianti:*     │ │
        │ │ handcrafted_dishes │ │      │ │handcrafted:* │ │
        │ │ restaurant3_dishes │ │      │ │restaurant3:* │ │
        │ └────────────────────┘ │      │ └──────────────┘ │
        └────────────────────────┘      └──────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Tenant Resolver** | Extract tenant ID from subdomain, validate tenant exists |
| **Auth Middleware** | Session management, API key validation |
| **Rate Limiter** | Per-tenant rate limiting |
| **Menu Service** | Tenant-aware menu operations |
| **Recommendation Service** | ML-based recommendations per tenant |
| **Session Management** | User sessions scoped to tenant |

## 3. Database Design

### 3.1 Tenant Isolation Strategy

**Approach**: **Database-per-tenant** using separate collections/keyspaces

**Rationale**:
- Complete data isolation
- Independent scaling per tenant
- Easy backup/restore per restaurant
- Clear compliance boundaries

### 3.2 Qdrant Vector Database Structure

```python
# Collection naming convention
COLLECTION_NAME_PATTERN = "{tenant_id}_dishes"

# Examples:
# - chianti_dishes
# - handcrafted_dishes  
# - mariospizza_dishes
```

