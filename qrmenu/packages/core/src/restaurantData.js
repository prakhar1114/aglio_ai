let globalRestaurantData = {
  slug: null,
  name: null
};

export function setRestaurantData(slug, name) {
  globalRestaurantData = { slug, name };
}

export function getRestaurantSlug() {
  return import.meta.env.VITE_RESTAURANT_SLUG || globalRestaurantData.slug;
}

export function getRestaurantName() {
  return import.meta.env.VITE_RESTAURANT_NAME || globalRestaurantData.name || 'Restaurant';
} 