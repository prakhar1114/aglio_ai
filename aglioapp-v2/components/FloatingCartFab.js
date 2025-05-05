import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import useStore from '../store';

export default function FloatingCartFab() {
  const navigation = useNavigation();
  const route = useRoute();
  const cart = useStore((state) => state.cart);
  const cartCount = cart.length;

  // Hide FAB on /cart or /success
  if (cartCount === 0 || ['Cart', 'Success'].includes(route.name)) return null;

  return (
    <View style={styles.fabContainer} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Cart')}
        accessibilityRole="button"
        accessibilityLabel="View Cart"
      >
        <Text style={styles.fabText}>View Cart</Text>
        <Text style={styles.countText}>{cartCount} {cartCount === 1 ? 'item' : 'items'}</Text>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 12,
  },
  countText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  arrow: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 8,
  },
});
