import { Tabs } from "expo-router";
import React from "react";
import { Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#16181f",
          borderTopColor: "#2a2d3a",
          height: 65,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: "#00e5a0",
        tabBarInactiveTintColor: "#6b7080",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📷</Text>,
        }}
      />
      <Tabs.Screen
        name="liste"
        options={{
          title: "Ma liste",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📋</Text>,
        }}
      />
    </Tabs>
  );
}
