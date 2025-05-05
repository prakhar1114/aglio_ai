import React from 'react';
import { Pressable, Text } from 'react-native';

export default function Chip({ label, active, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          borderRadius: 9999,
          paddingHorizontal: 12,
          paddingVertical: 4,
          backgroundColor: active ? '#3B82F6' : '#F1F5F9',
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text style={{ color: active ? '#fff' : '#1E293B', fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
