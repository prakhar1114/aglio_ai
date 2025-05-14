import React from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { fetchFeaturedDishes, fetchPreviousOrders } from '../lib/api';

const Sidebar = ({ isVisible, sidebarAnimation, toggleSidebar }) => {
  const navigation = useNavigation();
  const screenWidth = Dimensions.get('window').width;
  const sidebarWidth = screenWidth * 0.8; // 80% of screen width
  
  // Calculate sidebar position based on animation value
  const sidebarLeft = sidebarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-sidebarWidth, 0],
  });
  
  // Calculate overlay opacity based on animation value
  const overlayOpacity = sidebarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });
  
  return (
    <>
      {/* Semi-transparent overlay */}
      {isVisible && (
        <TouchableWithoutFeedback onPress={() => {
          toggleSidebar(true);
        }}>
          <Animated.View 
            style={[
              styles.overlay, 
              { opacity: overlayOpacity }
            ]} 
          />
        </TouchableWithoutFeedback>
      )}
      
      {/* Sidebar - always render but position off-screen when not visible */}
      <Animated.View 
        style={[
          styles.sidebar,
          { width: sidebarWidth, transform: [{ translateX: sidebarLeft }] }
        ]}
      >
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Chianti Ristorante</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.sidebarItem}
          onPress={() => {
            toggleSidebar(true); // Force close before navigation
            navigation.navigate('AI');
          }}
        >
          <Ionicons name="home" size={24} color="#333" />
          <Text style={styles.sidebarItemText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.sidebarItem}
          onPress={() => {
            toggleSidebar(true); // Force close before navigation
            navigation.navigate('Menu');
          }}
        >
          <Ionicons name="restaurant-outline" size={24} color="#333" />
          <Text style={styles.sidebarItemText}>Menu</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.sidebarItem}
          onPress={() => {
            toggleSidebar(true); // Force close before navigation
            navigation.navigate('Cart');
          }}
        >
          <Ionicons name="cart-outline" size={24} color="#333" />
          <Text style={styles.sidebarItemText}>Cart</Text>
        </TouchableOpacity>
        
        {/* <TouchableOpacity 
          style={styles.sidebarItem}
          onPress={() => {
            toggleSidebar(true); // Force close before navigation
            navigation.navigate('OrderHistory');
          }}
        >
          <Ionicons name="time-outline" size={24} color="#333" />
          <Text style={styles.sidebarItemText}>Order History</Text>
        </TouchableOpacity> */}

        <TouchableOpacity 
          style={styles.sidebarItem}
          onPress={() => {
            toggleSidebar(true); // Force close before navigation
            navigation.navigate('Filters');
          }}
        >
          <Ionicons name="filter-outline" size={24} color="#333" />
          <Text style={styles.sidebarItemText}>Filters</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.sidebarItem}
          onPress={async () => {
            toggleSidebar(true); // Force close before navigation
            await fetchFeaturedDishes();
            navigation.navigate('AI');
          }}
        >
          <Ionicons name="star-outline" size={24} color="#333" />
          <Text style={styles.sidebarItemText}>Featured</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.sidebarItem}
          onPress={async () => {
            toggleSidebar(true); // Force close before navigation
            await fetchPreviousOrders();
            navigation.navigate('AI');
          }}
        >
          <Ionicons name="time-outline" size={24} color="#333" />
          <Text style={styles.sidebarItemText}>Previous Orders</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 30,
    paddingTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  sidebarHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sidebarItemText: {
    fontSize: 16,
    marginLeft: 16,
  },
});

export default Sidebar;
