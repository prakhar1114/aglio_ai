import React from 'react';
import { View, Text } from 'react-native';

export default function Badge({ count, style, ...props }) {
  return (
    <View
      style={[{
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
      }, style]}
      accessibilityRole="status"
      accessibilityLiveRegion="polite"
      {...props}
    >
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{count}</Text>
    </View>
  );
}
