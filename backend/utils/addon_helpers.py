from typing import Tuple, List

from models.schema import CartItem, CartItemAddon, CartItemVariationAddon
from models.cart_models import SelectedAddonResponse


def resolve_addon_context(cart_item: CartItem) -> Tuple[List[object], str]:
    """Return the active addon rows list for this cart_item and its source type.

    If the cart item contains variation-specific addons those take precedence and are
    returned with source_type == "variation". Otherwise the base‐item addons are
    returned with source_type == "base".
    """
    if getattr(cart_item, "selected_variation_addons", None):
        if len(cart_item.selected_variation_addons) > 0:
            return list(cart_item.selected_variation_addons), "variation"
    return list(cart_item.selected_addons or []), "base"


def build_selected_addon_responses(addon_rows: List[object]):
    """Convert CartItem(Addon|VariationAddon) rows to SelectedAddonResponse list & total."""
    responses: List[SelectedAddonResponse] = []
    total: float = 0.0

    for row in addon_rows:
        addon_item = row.addon_item  # Both models expose .addon_item
        line_total = addon_item.price * row.quantity
        total += line_total
        responses.append(
            SelectedAddonResponse(
                addon_group_item_id=addon_item.id,
                name=addon_item.name,
                price=addon_item.price,
                quantity=row.quantity,
                total_price=line_total,
                addon_group_name=addon_item.addon_group.name,
                tags=addon_item.tags or [],
            )
        )

    return responses, total 