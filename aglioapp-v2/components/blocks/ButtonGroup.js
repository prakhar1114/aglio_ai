import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function ButtonGroup({ options = [], title = "Actions" }) {
  const navigation = useNavigation();
  const handleButtonPress = (path) => {
    if (path && path.startsWith('http')) {
      // Open external URLs
      Linking.openURL(path).catch(err => console.error('Error opening URL:', err));
    } else if (path) {
      // For internal navigation paths
      try {
        // If path contains parameters (format: 'ScreenName:param1=value1,param2=value2')
        if (path.includes(':')) {
          const [screenName, paramString] = path.split(':');
          const params = {};
          
          if (paramString) {
            paramString.split(',').forEach(param => {
              const [key, value] = param.split('=');
              params[key] = value;
            });
          }
          
          navigation.navigate(screenName, params);
        } else {
          // Simple navigation without params
          navigation.navigate(path);
        }
      } catch (error) {
        console.error('Navigation error:', error);
      }
    }
  };

  const renderButton = (button, index) => {
    return (
      <TouchableOpacity
        key={index}
        style={styles.button}
        onPress={() => handleButtonPress(button.path)}
        accessibilityRole="button"
        accessibilityLabel={button.text || `Button ${index + 1}`}
      >
        <Text style={styles.buttonText}>{button.text}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionContainer}>
        {title && <Text style={styles.sectionTitle}>{title}</Text>}
        
        <ScrollView 
          horizontal={options.length > 2}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.buttonContainer}
        >
          {options.map((button, index) => renderButton(button, index))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  sectionContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    marginBottom: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  }
});
