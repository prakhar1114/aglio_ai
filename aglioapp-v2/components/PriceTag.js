import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PriceTag = ({ price }) => (
  <View style={styles.container}>
    <Text style={styles.text}>${price.toFixed(2)}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#eee',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default PriceTag;
