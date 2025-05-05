import { StatusBar } from 'expo-status-bar';
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { config } from '@gluestack-ui/config';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Welcome from '@/screens/Welcome';
import Auth from '@/screens/Auth';
import Filters from '@/screens/Filters';
import Home from '@/screens/Home';
import Menu from '@/screens/Menu';
import * as Linking from 'expo-linking';

const linking = {
  prefixes: [Linking.createURL('/')],
};

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GluestackUIProvider mode="light">
      <NavigationContainer linking={linking} fallback={<Text>Loading...</Text>}>
        <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Welcome" component={Welcome} />
          <Stack.Screen name="Auth" component={Auth} />
          <Stack.Screen name="Filters" component={Filters} />
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Menu" component={Menu} />
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
