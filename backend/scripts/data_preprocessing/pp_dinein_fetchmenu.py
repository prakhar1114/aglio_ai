#!/usr/bin/env python3
"""
Fetch PetPooja dine-in menu using the credentials in `pp_staging.json`,
store the API response as `menu.json`, and generate a `menu.csv` file that is
ready for manual editing / onboarding (same columns & logic as
`pp_generate_menu_csv.py`).

Usage:
    python pp_dinein_fetchmenu.py            # uses default pp_staging.json next to the script
    python pp_dinein_fetchmenu.py /path/to/pp_staging.json

Both `menu.json` and `menu.csv` are written in the same directory as the
provided `pp_staging.json` file.
"""

import json
import sys
from pathlib import Path

import requests
from loguru import logger

# Import helper functions from the existing CSV generator script
try:
    from pp_utils import (
        extract_menu_items_from_json,
        generate_csv_file,
        analyze_petpooja_data,
    )
except ModuleNotFoundError as e:
    logger.error("❌ Could not import utilities from pp_utils.py. Make sure the script exists in the same directory. Error: {}", e)
    sys.exit(1)


def load_config(config_file: Path) -> dict:
    if not config_file.exists():
        logger.error("❌ Config file not found: {}", config_file)
        sys.exit(1)
    with open(config_file, "r") as f:
        return json.load(f)


def call_fetchmenu_api(config: dict, table_no: str = "") -> dict:
    """Low-level helper to call the PetPooja fetchmenu_dinein API."""
    api_url = config["apis"]["fetchmenu_dinein"]
    payload = {"restID": config["restID"], "tableNo": table_no}
    headers = {
        "Content-Type": "application/json",
        "app-key": config["app-key"],
        "app-secret": config["app-secret"],
        "access-token": config["access-token"],
    }

    logger.info("📡 Calling fetchmenu_dinein (tableNo='{}') → {}", table_no or "", api_url)
    response = requests.post(api_url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    logger.success("✅ API call successful – status {}", response.status_code)
    return response.json()


def main():
    # Determine config path (argument or default next to this script)
    if len(sys.argv) > 1:
        config_path = Path(sys.argv[1]).expanduser().resolve()
    else:
        config_path = Path(__file__).with_name("pp_staging.json")

    output_dir = config_path.parent
    output_json_path = output_dir / "menu.json"
    output_csv_path = output_dir / "menu.csv"

    logger.info("🔧 Using config: {}", config_path)
    logger.info("📂 Output directory: {}", output_dir)

    # Step 1: Load credentials / endpoints
    config = load_config(config_path)

    # Step 2: Fetch menu JSON
    # 2a) Fetch areas (no table number)
    areas_json = call_fetchmenu_api(config, table_no="")

    # Save areas.json for reference
    areas_path = output_dir / "areas.json"
    with open(areas_path, "w") as f:
        json.dump(areas_json, f, indent=4)
    logger.success("💾 Saved areas JSON → {}", areas_path)

    # Determine a table number (pick the first active table)
    tables = areas_json.get("tables", [])
    if not tables:
        logger.error("❌ No tables returned in areas response. Cannot proceed to fetch menu.")
        sys.exit(1)

    table_no = tables[0].get("table_no", "")
    logger.info("🪑 Using table_no='{}' to fetch the menu", table_no)

    # 2b) Fetch menu for that table number
    menu_json = call_fetchmenu_api(config, table_no=table_no)

    # Step 3: Write menu.json
    with open(output_json_path, "w") as f:
        json.dump(menu_json, f, indent=4)
    logger.success("💾 Saved menu JSON → {}", output_json_path)

    # Step 4: Analyze & generate CSV
    analyze_petpooja_data(output_json_path)
    menu_items = extract_menu_items_from_json(output_json_path)
    generate_csv_file(menu_items, output_csv_path)
    logger.success("🎉 All done! Generated CSV → {}", output_csv_path)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.warning("Interrupted by user. Exiting...")