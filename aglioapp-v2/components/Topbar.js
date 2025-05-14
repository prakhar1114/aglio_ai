import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const Topbar = ({ 
  heading, 
  onMenuPress, 
  showMenuButton = true, 
  buttonText = "Menu", 
  buttonPath = "Menu" 
}) => {
  const navigation = useNavigation();
  const handleMenuPress = () => {
    onMenuPress && onMenuPress();
  };
  return (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.menuButton} 
        onPress={handleMenuPress}
        activeOpacity={0.7}
      >
        <Ionicons name="menu" size={24} color="#333" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>{heading}</Text>
      
      {showMenuButton ? (
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => navigation.navigate(buttonPath)}
          activeOpacity={0.7}
        >
          <Text style={styles.navButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.rightPlaceholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
    zIndex: 50,
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  rightPlaceholder: {
    width: 40, // To ensure the title stays centered
  },
  navButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default Topbar;
