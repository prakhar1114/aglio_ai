export function getActiveAddonGroups(menuItem, selectedVariationId) {
  // Safety checks
  if (!menuItem) return [];

  // If a variation is selected, check if that variation defines override addon_groups
  if (selectedVariationId && Array.isArray(menuItem.variation_groups)) {
    for (const vg of menuItem.variation_groups) {
      const variation = vg.variations?.find?.((v) => v.id === selectedVariationId);
      if (variation && Array.isArray(variation.addon_groups) && variation.addon_groups.length > 0) {
        return variation.addon_groups;
      }
    }
  }

  // Fall back to base‐item addon groups
  return Array.isArray(menuItem.addon_groups) ? menuItem.addon_groups : [];
} 