import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import useStore from '../store';
import QtyStepper from './ui/QtyStepper';
import { MaterialIcons } from '@expo/vector-icons';

export default function CartItemRow({ item }) {
  const updateQty = useStore((state) => state.updateQty);
  const removeItem = useStore((state) => state.removeFromCart);

  return (
    <View style={styles.row}>
      <Image
        source={item.image_url ? { uri: item.image_url } : require('../assets/icon.png')}
        style={styles.thumb}
      />
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>₹{item.price}</Text>
      </View>
      <QtyStepper
        qty={item.qty || 1}
        onChange={(newQty) => updateQty(item.id, newQty)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 8,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 2,
  },
  price: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 14,
  },
  trashBtn: {
    marginLeft: 8,
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
