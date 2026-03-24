import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppRoot } from './src/app/AppRoot';
import { useThemeColors } from './src/shared/theme/useTheme';

export default function App() {
  const colors = useThemeColors();
  return (
    <SafeAreaProvider>
      {/* translucent + transparent background = required for edgeToEdgeEnabled:true.
          The header's own backgroundColor covers the status-bar area on all screens. */}
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <AppRoot />
    </SafeAreaProvider>
  );
}
