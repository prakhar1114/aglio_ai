# Restaurant On‑Boarding Pack — Folder Specification  
*Version 2025‑06 (keep this header so we can detect outdated packs)*

To add your venue to our QR‑ordering system, prepare **ONE folder** that contains every file listed below, zip the folder, and send it to us.  
The folder name itself should be your **slug** (lower‑case, no spaces).

```
my‑bistro/                    <- folder name = your slug
├── meta.json
├── hours.json                # optional
├── tables.json
├── menu.csv
└── images/                   # required (downloaded images go here)
    └── *.jpg | *.png | *.jpeg
```

---

## 1. `meta.json` — restaurant identity  *(required)*

| key | type | example | notes |
|-----|------|---------|-------|
| `public_id` | string | `"mbistro"` | Unique across all restaurants (6‑12 chars, letters + digits). |
| `restaurant_name` | string | `"My Bistro & Coffee"` | Display name that guests will see. |
| `slug` | string | `"my‑bistro"` | Used for your sub‑domain. |
| `tz` | string | `"Asia/Kolkata"` | IANA time‑zone of the venue. |

```json
{
  "public_id": "mbistro",
  "restaurant_name": "My Bistro & Coffee",
  "slug": "my-bistro",
  "tz": "Asia/Kolkata"
}
```

---

## 2. `hours.json` — opening hours  *(optional)*

If omitted we assume **24 h** service.

Array with one object per day of the week:

| field | type | example |
|-------|------|---------|
| `day` | int (0 = Sunday … 6 = Saturday) | `1` |
| `opens_at` | `"HH:MM"` | `"08:00"` |
| `closes_at` | `"HH:MM"` | `"22:30"` |

```json
[
  { "day": 0, "opens_at": "08:00", "closes_at": "22:30" },
  { "day": 1, "opens_at": "08:00", "closes_at": "22:30" },
  { "day": 2, "opens_at": "08:00", "closes_at": "22:30" }
]
```

---

## 3. `tables.json` — physical seating  *(required)*

| key | type | example | notes |
|-----|------|---------|-------|
| `number_of_tables` | int | `12` | How many numbered tables exist. |
| `pass_required` | bool | `false` | Set **true** to demand a daily word before ordering. |
| `password` | string \| null | `"latte29"` | Word valid **today only** (ignored if `pass_required` is false). |

```json
{
  "number_of_tables": 12,
  "pass_required": false,
  "password": null
}
```

---

## 4. `menu.csv` — every dish & drink  *(required)*

CSV **header row must match exactly**:

```
name,category_brief,group_category,description,price,image_path,
veg_flag,is_bestseller,is_recommended,kind,priority,promote,public_id
```

* `price` — **float**, in rupees with two decimals (e.g. `199.00`).  
* `image_path` — **Can be one of three formats:**
  - **Local filename:** `cappuccino.jpg` (file must exist in `images/` folder)
  - **Instagram URL:** `https://www.instagram.com/p/ABC123/` (will be auto-downloaded to `images/` folder)
  - **Regular URL:** `https://example.com/image.jpg` (will be auto-downloaded to `images/` folder)
* Boolean columns (`veg_flag`, `is_bestseller`, `is_recommended`, `promote`) ⇒ `TRUE` / `FALSE`.  
* `public_id` — leave blank to let us auto‑generate.

Example with mixed image sources:

```csv
name,category_brief,group_category,description,price,image_path,veg_flag,is_bestseller,is_recommended,kind,priority,promote,public_id
Cappuccino,Coffee,Beverages,Double espresso with milk foam,240.00,cappuccino.jpg,FALSE,TRUE,TRUE,beverage,0,FALSE,
Veg Margherita,Classic Pizzas,Pizza,Tomato sauce & cheese,350.00,https://www.instagram.com/p/ABC123/,TRUE,TRUE,FALSE,food,1,TRUE,vmarg01
Latte Art,Coffee,Beverages,Premium latte with art,280.00,https://example.com/latte.jpg,FALSE,FALSE,TRUE,beverage,2,FALSE,
```

---

## 5. `images/` — product photos *(required)*

* **This folder is mandatory** — it must exist even if empty initially.
* For local files: Place every referenced `image_path` file here.  
* For URLs: Downloaded images will be automatically saved here.
* Filenames must be ASCII‑safe, ideally lower‑case.  
* Max 1 MB each.  
* Supported formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.mp4` (for videos).

**Auto-Download Features:**
- **Instagram URLs:** Supports posts (`/p/`) and reels (`/reel/`). Will download the first image/video from carousel posts.
- **Regular URLs:** Automatically detects content type and assigns appropriate file extension.
- **Downloaded files:** Saved with safe filenames (e.g., `0_Cappuccino.jpg`) in the `images/` folder.
- **Error Handling:** If download fails, `image_path` is set to null and processing continues.

---

## 6. Validation checklist

1. All required files present (`meta.json`, `tables.json`, `menu.csv`, `images/` folder).  
2. No extra columns in `menu.csv`; header matches spec.  
3. For local files: Every `image_path` exists in `images/`.
4. For URLs: Valid HTTP/HTTPS URLs that are accessible.
5. `price` > 0.  
6. `public_id` (if filled) unique inside the CSV.

The onboarding script will halt and print an error if any check fails.

**URL Processing:**
- URLs in `image_path` are automatically detected and downloaded during onboarding.
- Downloaded files are saved with safe filenames in the `images/` folder.
- The original `menu.csv` is updated to reflect local filenames instead of URLs.
- Failed downloads are logged but won't stop the onboarding process.

---

## 7. After you send us the ZIP

* We validate & import your data into Postgres.  
* **Image URLs are automatically downloaded** to the `images/` folder.
* Opening hours and table QR codes go live instantly.  
* Updated `menu.csv` reflects local filenames instead of original URLs.

That's it—happy onboarding! 🎉
