import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';

const ItemCard = ({ item, onPress }) => (
  <View style={styles.card}>
    <Image
      source={item.image_url ? { uri: item.image_url } : require('../assets/icon.png')}
      style={styles.image}
    />
    <View style={styles.infoColumn}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
    <View style={styles.rightColumn}>
      {item.price ? (
        <Text style={styles.priceTag}>{`₹${item.price}`}</Text>
      ) : null}
      <TouchableOpacity style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    paddingHorizontal: 5,
    paddingVertical: 10,
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
  // rowNamePrice removed, no longer needed
  
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingRight: 60, // ensures name doesn't overlap with price
  },
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 48,
    marginLeft: 1,
  },
  priceTag: {
    color: '#222',
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
    alignSelf: 'flex-end',
  },
  description: {
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  addButton: {
    width: 32,
    height: 32,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    alignSelf: 'flex-end',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 24,
  },
});

export default ItemCard;
