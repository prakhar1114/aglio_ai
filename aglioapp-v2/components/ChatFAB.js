import React, { useEffect, useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useRoute } from '@react-navigation/native';
import analytics from '../lib/analytics';

const ChatFAB = ({ onPress }) => {
  const route = useRoute();
  const scale = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 200, damping: 20 });
    translateY.value = withDelay(
      6000,
      withRepeat(
        withSequence(withTiming(-4, { duration: 500 }), withTiming(0, { duration: 500 })),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  if (route.name === 'Cart' || route.name === 'Success') return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#08A045',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        },
        animatedStyle,
      ]}
    >
      <TouchableOpacity 
        onPress={() => {
          analytics.trackFabOpened();
          onPress();
        }} 
        accessibilityLabel="Chat with Aglio" 
        accessibilityRole="button" 
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default ChatFAB;
