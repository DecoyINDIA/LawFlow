import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '../../src/theme';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const c = useColors();
  return (
    <Feather name={name as any} size={22} color={focused ? c.textPrimary : c.textTertiary} />
  );
}

export default function TabsLayout() {
  const c = useColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopWidth: 0.5,
          borderTopColor: c.border,
          height: Platform.OS === 'ios' ? 82 : 62,
          paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: c.textPrimary,
        tabBarInactiveTintColor: c.textTertiary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} /> }}
      />
      <Tabs.Screen
        name="cases"
        options={{ title: 'Cases', tabBarIcon: ({ focused }) => <TabIcon name="briefcase" focused={focused} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} /> }}
      />
      <Tabs.Screen
        name="clients"
        options={{ title: 'Clients', tabBarIcon: ({ focused }) => <TabIcon name="users" focused={focused} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: ({ focused }) => <TabIcon name="more-horizontal" focused={focused} /> }}
      />
    </Tabs>
  );
}
