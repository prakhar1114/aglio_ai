import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import useStore from '@/store';
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { config } from '@gluestack-ui/config';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Welcome from '@/screens/Welcome';
import Auth from '@/screens/Auth';
import Filters from '@/screens/Filters';
import Home from '@/screens/Home';
import Menu from '@/screens/Menu';
import OrderPreview from '@/screens/OrderPreview';
import Success from '@/screens/Success';
import * as Linking from 'expo-linking';
import { initializeSocket } from '@/lib/socket';

const navigationRef = createNavigationContainerRef();

const linking = {
  prefixes: [Linking.createURL('/')],
};

const Stack = createNativeStackNavigator();

export default function App() {
  const sessionId = useStore(state => state.sessionId);
  useEffect(() => {
    if (sessionId) {
      initializeSocket();
    }
    if (!sessionId && navigationRef.isReady()) {
      navigationRef.navigate('Auth');
    }
  }, [sessionId]);

  return (
    <GluestackUIProvider mode="light">
      <NavigationContainer ref={navigationRef} linking={linking} fallback={<Text>Loading...</Text>}>
        <Stack.Navigator initialRouteName="Auth" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Welcome" component={Welcome} />
          <Stack.Screen name="Auth" component={Auth} />
          <Stack.Screen name="Filters" component={Filters} />
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Menu" component={Menu} />
          <Stack.Screen name="Cart" component={OrderPreview} />
          <Stack.Screen name="Success" component={Success} />
        </Stack.Navigator>
      </NavigationContainer>
    </GluestackUIProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
