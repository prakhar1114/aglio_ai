import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Animated } from 'react-native';
import Topbar from '@/components/Topbar';
import Sidebar from '@/components/Sidebar';
import { fetchPreviousOrders } from '@/lib/api';
import ThumbnailRow from '@/components/blocks/ThumbnailRow';
import FloatingCartFab from '@/components/FloatingCartFab';

export default function OrderHistory() {
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  
  // Sidebar animation state
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarAnimation = useRef(new Animated.Value(0)).current;
  
  // Load previous orders when component mounts
  useEffect(() => {
    loadPreviousOrders();
  }, []);
  
  // Toggle sidebar visibility
  const toggleSidebar = (forceClose = false) => {
    const newValue = forceClose ? false : !sidebarVisible;
    setSidebarVisible(newValue);
    Animated.timing(sidebarAnimation, {
      toValue: newValue ? 1 : 0,
      duration: 300,
      useNativeDriver: false
    }).start();
  };
  
  // Fetch previous orders from API
  const loadPreviousOrders = async () => {
    try {
      setIsLoading(true);
      const response = await fetchPreviousOrders();
      
      if (response && response.blocks) {
        // Process the response blocks
        const processedOrders = response.blocks
          .filter(block => block.type === "thumbnail_row")
          .map(block => ({
            date: block.date,
            options: block.options || []
          }));
        
        setOrders(processedOrders);
      }
    } catch (err) {
      console.error('Error fetching previous orders:', err);
      setError('Failed to load your order history. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Group orders by date
  const getGroupedOrders = () => {
    // This assumes orders are already sorted by date from the API
    return orders;
  };
  
  return (
    <View style={styles.container}>
      <Topbar 
        heading="Order History" 
        onMenuPress={toggleSidebar}
        showMenuButton={true}
      />
      
      <Sidebar 
        isVisible={sidebarVisible} 
        sidebarAnimation={sidebarAnimation} 
        toggleSidebar={toggleSidebar} 
      />
      
      <ScrollView style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#9C27B0" />
            <Text style={styles.loadingText}>Loading your order history...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You don't have any previous orders yet.</Text>
          </View>
        ) : (
          <View style={styles.ordersContainer}>
            <Text style={styles.pageTitle}>Your Order History</Text>
            
            {getGroupedOrders().map((orderGroup, index) => (
              <View key={`order-group-${index}`} style={styles.orderGroup}>
                <ThumbnailRow 
                  options={orderGroup.options}
                  title={`${orderGroup.date}`}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <FloatingCartFab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  ordersContainer: {
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  orderGroup: {
    marginBottom: 5,
  },
});
