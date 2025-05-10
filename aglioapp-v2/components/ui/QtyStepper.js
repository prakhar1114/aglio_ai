import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { StyleSheet } from 'react-native';

export default function QtyStepper({ qty, onChange, style, isVertical = false }) {
  const decrement = () => onChange(qty - 1);
  const increment = () => onChange(qty + 1);
  return (
    <View style={[styles.container, isVertical && styles.containerVertical, style]}>
      {isVertical ? (
        <>
          <TouchableOpacity
            onPress={increment}
            style={[styles.btn, styles.btnVertical]}
            accessibilityLabel="Increase quantity"
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>+</Text>
          </TouchableOpacity>
          <Text style={[styles.qtyText, styles.qtyTextVertical]}>{qty}</Text>
          <TouchableOpacity
            onPress={decrement}
            style={[styles.btn, styles.btnVertical]}
            accessibilityLabel="Decrease quantity"
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>-</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            onPress={decrement}
            style={styles.btn}
            accessibilityLabel="Decrease quantity"
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtyText}>{qty}</Text>
          <TouchableOpacity
            onPress={increment}
            style={styles.btn}
            accessibilityLabel="Increase quantity"
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>+</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 18,
    paddingHorizontal: 6,
    height: 36,
    alignSelf: 'center', // Changed from flex-start to center
    justifyContent: 'center', // Added to ensure content is centered
  },
  containerVertical: {
    flexDirection: 'column',
    paddingHorizontal: 0,
    paddingVertical: 3,
    height: 90,
    width: 40,
    justifyContent: 'space-between',
    borderRadius: 10,
  },
  btn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
    backgroundColor: 'transparent',
  },
  btnVertical: {
    marginHorizontal: 0,
    marginVertical: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  btnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  qtyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 4,
    minWidth: 18,
    textAlign: 'center',
  },
  qtyTextVertical: {
    marginHorizontal: 0,
    marginVertical: 0,
    fontSize: 20,
    minWidth: 24,
  },
});
