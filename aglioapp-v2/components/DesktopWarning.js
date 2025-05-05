import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DesktopWarning = () => (
  <View style={styles.container}>
    <Text style={styles.text}>
      Desktop not supported. Please use a mobile device.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
  },
});

export default DesktopWarning;
