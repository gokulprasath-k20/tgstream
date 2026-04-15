import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import LoginScreen    from './screens/LoginScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatScreen     from './screens/ChatScreen';
import RequestsScreen from './screens/RequestsScreen';
import ContactsScreen from './screens/ContactsScreen';
import CallScreen     from './screens/CallScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle:           { backgroundColor: '#0a0b15', borderTopColor: 'rgba(255,255,255,0.05)' },
        tabBarActiveTintColor:  '#6366f1',
        tabBarInactiveTintColor:'#6b7280',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{ tabBarLabel: 'Chats', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>💬</Text> }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{ tabBarLabel: 'Requests', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📬</Text> }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{ tabBarLabel: 'Contacts', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👥</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle:     { backgroundColor: '#0a0b15' },
          headerTintColor: '#fff',
          headerTitleStyle:{ fontWeight: 'bold' },
          contentStyle:    { backgroundColor: '#05060f' },
        }}
      >
        <Stack.Screen name="Login"   component={LoginScreen}  options={{ headerShown: false }} />
        <Stack.Screen name="Main"    component={MainTabs}     options={{ headerShown: false }} />
        <Stack.Screen name="Chat"    component={ChatScreen}   options={{ title: 'Chat' }} />
        <Stack.Screen name="Call"    component={CallScreen}   options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
