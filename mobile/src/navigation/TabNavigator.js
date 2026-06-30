import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, User, Swords } from 'lucide-react-native';

import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BattlesScreen from '../screens/BattlesScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Home') {
            return <Home color={color} size={size} />;
          } else if (route.name === 'Battles') {
            return <Swords color={color} size={size} />;
          } else if (route.name === 'Profile') {
            return <User color={color} size={size} />;
          }
        },
        tabBarActiveTintColor: '#4f46e5', // indigo-600
        tabBarInactiveTintColor: '#64748b', // slate-500
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          paddingBottom: 5,
          paddingTop: 5,
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Bülten' }} />
      <Tab.Screen name="Battles" component={BattlesScreen} options={{ title: 'Düellolar' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
