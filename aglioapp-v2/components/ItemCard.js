import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import QtyStepper from './ui/QtyStepper';

const ItemCard = ({ item, onPress, onAdd, onRemove, onQtyChange, cartQty, showDescription = true, isVertical = false }) => {
  const [added, setAdded] = useState(cartQty > 0);
  const [qty, setQty] = useState(cartQty > 0 ? cartQty : 1);
  useEffect(() => {
    setAdded(cartQty > 0);
    setQty(cartQty > 0 ? cartQty : 1);
  }, [cartQty]);
  const handleAdd = (e) => {
    e.stopPropagation();
    onAdd && onAdd(item);
    setAdded(true);
  };
  const handleChange = (newQty) => {
    setQty(newQty);
    onQtyChange && onQtyChange(item.id, newQty);
    if (newQty <= 0) {
      setAdded(false);
      onRemove && onRemove(item.id);
    }
  };
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Image
        source={item.image_url ? { uri: item.image_url } : require('../assets/icon.png')}
        style={styles.image}
      />
      <View style={styles.infoColumn}>
        <Text style={styles.name}>{item.name}</Text>
        {showDescription && <Text style={styles.description}>{item.description}</Text>}
      </View>
      <View style={styles.rightColumn}>
        {item.price ? (
          <Text style={styles.priceTag}>{`₹${item.price}`}</Text>
        ) : null}
        {!added ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAdd}
            accessibilityLabel={`Add ${item.name} to cart`}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        ) : (
          <QtyStepper
            qty={qty}
            onChange={handleChange}
            style={styles.qtyStepper}
            isVertical={isVertical}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    alignItems: 'flex-start',
    position: 'relative',
    backgroundColor: '#fff',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  infoColumn: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
    marginRight: 2, // 2px gap between description and button
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    paddingRight: 60, // ensures name doesn't overlap with price
  },
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 48,
    marginLeft: 1,
  },
  priceTag: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
    alignSelf: 'flex-end',
    // borderWidth: 1,
    // borderColor: '#e5e7eb',
  },
  description: {
    color: '#222',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    alignSelf: 'flex-end',
    // borderWidth: 2,
    // borderColor: '#1D4ED8',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  qtyStepper: {
    width: undefined,
    marginTop: 0,
    alignSelf: 'flex-end',
  },
});

export default ItemCard;
