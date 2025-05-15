import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { sendMessage } from '../lib/socket';
import { useNavigation } from '@react-navigation/native';

const QuickRepliesPreview = ({ options }) => {
  const navigation = useNavigation();
  
  if (!options || options.length === 0) return null;

  const handlePress = (option) => {
    // Navigate to AI screen
    navigation.navigate('AI');
    
    // Send message after a short delay to ensure navigation is complete
    setTimeout(() => {
      sendMessage({
        _id: Math.round(Math.random() * 1000000),
        text: option,
        createdAt: new Date(),
        user: {
          _id: "user", // User's ID
        }
      });
    }, 300);
  };

  return (
    <View style={styles.container}>
      <View style={styles.pillsContainer}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.chip}
            onPress={() => handlePress(option)}
            accessibilityRole="button"
            accessibilityLabel={option}
          >
            <Text style={styles.chipText}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  chip: {
    borderRadius: 24,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
});

export default QuickRepliesPreview;
