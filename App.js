import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import HomeScreen from './src/HomeScreen';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar />
      <HomeScreen />
    </SafeAreaView>
  );
}
