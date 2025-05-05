# Backend Tasks – Aglio v2 API Expansion

The following bite‑sized tasks can be picked up one after another.  
Check them off as you complete each one.
Codebase Structure:
main.py: contains app
urls/: all new routes defined here, files to be created when needed so that the code is easy to navigate.

- [X] **Create `Category` schema** – Pydantic model with `group_category: str`, `category_brief: str`.
- [X] **Write helper `get_all_categories()`** that queries Qdrant for unique `(group_category, category_brief)` pairs.
- [X] **Add `GET /categories` route**  
      *Params:* `session_id` (str, required)  
      *Response:* `list[Category]`.
- [X] **Create `MenuItem` schema** – mirrors payload: `id, name, description, price, veg_flag, image_url`.
- [X] **Add `GET /menu` route**  
      *Params:* `session_id` (required) + optional `group_category`, `is_veg`, `price_cap`  
      *Logic:* vectorless filter query against Qdrant; returns `list[MenuItem]`.
- [ ] **Add `/filtered_recommendations` route** – supersedes old `/recommend`; requires `session_id` and supports optional `is_veg`, `price_cap`, `group_category` filters.
- [ ] **Update inline docs & tests** for all new endpoints (including `/filtered_recommendations`).