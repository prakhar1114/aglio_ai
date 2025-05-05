import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useStore from '../store';
import { MaterialIcons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';

export default function Success() {
  const navigation = useNavigation();
  const cartSnapshot = useStore(state => state.currentOrder);
  const { width: windowWidth } = Dimensions.get('window');

  return (
    <View style={styles.container}>
      <ConfettiCannon count={200} origin={{ x: windowWidth / 2, y: 0 }} fadeOut autoStart />
      <View style={styles.iconCircle}>
        <MaterialIcons name="check-circle" size={64} color="#22c55e" />
      </View>
      <Text style={styles.title}>Order Placed!</Text>
      <Text style={styles.subtitle}>Show this to wait staff</Text>
      <FlatList
        data={cartSnapshot}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemQty}>×{item.qty || 1}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 16 }}>No items.</Text>}
        style={{ marginTop: 24, marginBottom: 24 }}
      />
      <TouchableOpacity
        style={styles.menuBtn}
        onPress={() => navigation.navigate('Menu')}
        accessibilityRole="button"
        accessibilityLabel="Back to Menu"
      >
        <Text style={styles.menuBtnText}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconCircle: {
    backgroundColor: '#e0fce9',
    borderRadius: 48,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemName: {
    fontSize: 16,
    color: '#222',
    flex: 1,
  },
  itemQty: {
    fontWeight: 'bold',
    color: '#3B82F6',
    marginLeft: 8,
  },
  menuBtn: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  menuBtnText: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
