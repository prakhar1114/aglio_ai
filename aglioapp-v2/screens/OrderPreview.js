import React, { useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Animated, Modal } from 'react-native';
import useStore from '../store';
import ItemCard from '../components/ItemCard';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';
import UpsellModal from '../components/UpsellModal';
import ItemPreviewModal from '../components/ItemPreviewModal';


export default function OrderPreview({ navigation }) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [hasSeenUpsell, setHasSeenUpsell] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const sidebarAnimation = useRef(new Animated.Value(0)).current;
  
  // Zustand store access
  const cart = useStore((state) => state.cart);
  const addToCart = useStore((state) => state.addToCart);
  const removeFromCart = useStore((state) => state.removeFromCart);
  const updateQty = useStore((state) => state.updateQty);
  const setCurrentOrder = useStore((state) => state.setCurrentOrder);

  // Cart calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
  const tax = subtotal * 0.00; // placeholder 5%
  const total = subtotal + tax;
  const isCartEmpty = cart.length === 0;
  
  const toggleSidebar = (forceClose = false) => {
    const toValue = forceClose ? 0 : isSidebarVisible ? 0 : 1;
    
    Animated.timing(sidebarAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    setIsSidebarVisible(!isSidebarVisible && !forceClose);
  };

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
            onPress={() => {
              setSelectedItem(item);
              setModalVisible(true);
            }}
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
          } else if (!hasSeenUpsell) {
            // Show upsell modal only if user hasn't seen it before
            setShowUpsellModal(true);
            setHasSeenUpsell(true); // Mark as seen
          } else {
            // Skip upsell if already seen and go directly to success
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
      
      {/* Upsell Recommendations Modal */}
      {!isCartEmpty && (
        <UpsellModal
          visible={showUpsellModal}
          onClose={() => {
            setShowUpsellModal(false);
            // We already set hasSeenUpsell when showing the modal on button press,
            // but we set it here too in case the modal was shown automatically
            setHasSeenUpsell(true);
          }}
          onNoThanks={() => {
            setShowUpsellModal(false);
            setHasSeenUpsell(true);
            setCurrentOrder();
            navigation.navigate('Success');
          }}
          autoShow={!hasSeenUpsell} // Only auto-show if hasn't seen it yet
          initialDelay={4000}
          onShow={() => {
            setShowUpsellModal(true);
            setHasSeenUpsell(true);
          }}
        />
      )}
      
      {/* Item Preview Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <ItemPreviewModal
          visible={modalVisible}
          item={selectedItem}
          onClose={() => setModalVisible(false)}
        />
      </Modal>
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

  cartContainer: {
    marginBottom: 20,
  },
  emptyCartMessage: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginVertical: 20,
  },
  button: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#a9a9a9',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  addButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },

});
