import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { sendMessage } from '../../lib/socket';

export default function QuickReplies({ options }) {
  const [enableOptions, setEnableOptions] = useState(true);
  if (!options || options.length === 0) return null;

  const handlePress = (option) => {
    if (!enableOptions) return;
    setEnableOptions(false);
    sendMessage({
        _id: Math.round(Math.random() * 1000000),
        text: option,
        createdAt: new Date(),
        user: {
          _id: "user", // User's ID
        }
      });
  };

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={enableOptions ? styles.chip : styles.chipDisabled}
          onPress={() => handlePress(option)}
          accessibilityRole="button"
          accessibilityLabel={option}
        >
          <Text style={styles.chipText}>{option}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const chipBase = {
  borderRadius: 16,
  paddingVertical: 8,
  paddingHorizontal: 12,
  marginHorizontal: 4,
  borderWidth: 1,
  borderColor: '#DBEAFE',
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  chip: {
    ...chipBase,
    backgroundColor: '#EFF6FF',
  },
  chipText: {
    color: '#3B82F6',
    fontWeight: '500',
    fontSize: 14,
  },
  chipDisabled: {
    ...chipBase,
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#DBEAFE',
  },
});
