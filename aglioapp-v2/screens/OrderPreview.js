import React, { useState, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useStore from '../store';
import ItemCard from '../components/ItemCard';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';

export default function OrderPreview({ navigation }) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const sidebarAnimation = useRef(new Animated.Value(0)).current;
  
  const toggleSidebar = (forceClose = false) => {
    const toValue = forceClose ? 0 : isSidebarVisible ? 0 : 1;
    
    Animated.timing(sidebarAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    setIsSidebarVisible(!isSidebarVisible && !forceClose);
  };
  const cart = useStore((state) => state.cart);
  const addToCart = useStore((state) => state.addToCart);
  const removeFromCart = useStore((state) => state.removeFromCart);
  const updateQty = useStore((state) => state.updateQty);
  const setCurrentOrder = useStore((state) => state.setCurrentOrder);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
  const tax = subtotal * 0.00; // placeholder 5%
  const total = subtotal + tax;
  const isCartEmpty = cart.length === 0;

  return (
    <View style={styles.container}>
      <Topbar 
        heading="Cart" 
        onMenuPress={toggleSidebar}
        showMenuButton={true}
        buttonText="Home"
        buttonPath="Home"
      />
      <Sidebar 
        isVisible={isSidebarVisible}
        sidebarAnimation={sidebarAnimation}
        toggleSidebar={toggleSidebar}
      />
      <View style={styles.contentContainer}>
        <FlatList
        data={cart}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            cartQty={item.qty || 1}
            onAdd={addToCart}
            onRemove={removeFromCart}
            onQtyChange={updateQty}
            showDescription={false}
            isVertical={false}
          />
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 32 }}>Cart is empty.</Text>}
      />
      <View style={styles.summary}>
        <Text style={styles.summaryTextBold}>Total: ₹{total.toFixed(2)}</Text>
      </View>
      <TouchableOpacity
        style={styles.orderBtn}
        onPress={() => {
          if (isCartEmpty) {
            navigation.navigate('Menu');
          } else {
            setCurrentOrder();
            navigation.navigate('Success');
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={isCartEmpty ? "Back to Menu" : "Place Order"}
      >
        <Text style={styles.orderBtnText}>{isCartEmpty ? "Back to Menu" : "Place Order"}</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  summary: {
    marginTop: 24,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 16,
    color: '#222',
    marginBottom: 2,
  },
  summaryTextBold: {
    fontSize: 17,
    color: '#222',
    fontWeight: 'bold',
    marginTop: 4,
  },
  orderBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  orderBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
