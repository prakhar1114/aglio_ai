import React from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import useStore from '../store';
import useCartStore from '../store/cart';

export default function ItemPreviewModal({ visible, item, onClose }) {
  const addItem = useStore((state) => state.addToCart);
  const toggleWish = useCartStore((state) => state.toggleWish);

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.modalContent}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
          <Text style={{ fontSize: 20 }}>×</Text>
        </TouchableOpacity>
        <View style={styles.infoSection}>
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>₹{item.price}</Text>
          </View>
          <Text style={styles.desc}>{item.description}</Text>
        </View>
        <View style={styles.bottomBar}>
          <TouchableOpacity style={[styles.wishBtn, styles.outlineBtn]} onPress={() => toggleWish(item)}>
            <Text style={{ color: '#3B82F6', fontWeight: 'bold' }}>Wishlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => { addItem(item); onClose(); }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: 'column',
    overflow: 'hidden',
    maxHeight: '90%',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 1.5,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 0,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImage: {
    backgroundColor: '#e5e7eb',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    padding: 20,
    flexShrink: 1,
    justifyContent: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  desc: {
    color: '#64748B',
    marginTop: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
  },
  wishBtn: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  outlineBtn: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#fff',
  },
  addBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    alignItems: 'center',
  },
});
