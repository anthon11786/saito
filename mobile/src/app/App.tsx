import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SaitoProvider } from './SaitoProvider';
import * as SecureKeyStore from '../services/SecureKeyStore';
import type {
  RootStackParamList,
  OnboardingStackParamList,
  HomeStackParamList,
  ChatStackParamList,
  SettingsStackParamList,
  MainTabParamList,
} from '../types/navigation';

// Screens — Onboarding
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { CreateWalletScreen } from '../screens/CreateWalletScreen';
import { RestoreScreen } from '../screens/RestoreScreen';

// Screens — Wallet
import { HomeScreen } from '../screens/HomeScreen';
import { SendScreen } from '../screens/SendScreen';
import { ReceiveScreen } from '../screens/ReceiveScreen';
import { BackupScreen } from '../screens/BackupScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

// Screens — Chat
import { ChatListScreen } from '../screens/ChatListScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { NewChatScreen } from '../screens/NewChatScreen';
import { ChatSettingsScreen } from '../screens/ChatSettingsScreen';

// Screens — Settings
import { PeerSettingsScreen } from '../screens/PeerSettingsScreen';

const RootStack = createStackNavigator<RootStackParamList>();
const OnboardingNav = createStackNavigator<OnboardingStackParamList>();
const HomeNav = createStackNavigator<HomeStackParamList>();
const ChatNav = createStackNavigator<ChatStackParamList>();
const SettingsNav = createStackNavigator<SettingsStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: '#0f172a', shadowColor: 'transparent' },
  headerTintColor: '#f8fafc',
  headerTitleStyle: { fontWeight: '600' as const },
  cardStyle: { backgroundColor: '#0f172a' },
};

function OnboardingNavigator() {
  return (
    <OnboardingNav.Navigator screenOptions={screenOptions}>
      <OnboardingNav.Screen name="Welcome" component={OnboardingScreen} options={{ headerShown: false }} />
      <OnboardingNav.Screen name="CreateWallet" component={CreateWalletScreen} options={{ title: 'Create Wallet' }} />
      <OnboardingNav.Screen name="Restore" component={RestoreScreen} options={{ title: 'Restore Wallet' }} />
    </OnboardingNav.Navigator>
  );
}

function HomeNavigator() {
  return (
    <HomeNav.Navigator screenOptions={screenOptions}>
      <HomeNav.Screen name="Home" component={HomeScreen} options={{ title: 'Wallet' }} />
      <HomeNav.Screen name="Send" component={SendScreen as any} options={{ title: 'Send SAITO' }} />
      <HomeNav.Screen name="Receive" component={ReceiveScreen} options={{ title: 'Receive' }} />
    </HomeNav.Navigator>
  );
}

function ChatNavigator() {
  return (
    <ChatNav.Navigator screenOptions={screenOptions}>
      <ChatNav.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Chat' }} />
      <ChatNav.Screen
        name="Chat"
        component={ChatScreen as any}
        options={({ route }) => ({ title: route.params?.name || 'Chat' })}
      />
      <ChatNav.Screen name="NewChat" component={NewChatScreen as any} options={{ title: 'New Chat' }} />
      <ChatNav.Screen
        name="ChatSettings"
        component={ChatSettingsScreen as any}
        options={{ title: 'Chat Info' }}
      />
    </ChatNav.Navigator>
  );
}

function SettingsNavigator() {
  return (
    <SettingsNav.Navigator screenOptions={screenOptions}>
      <SettingsNav.Screen name="SettingsMain" component={SettingsScreen} options={{ title: 'Settings' }} />
      <SettingsNav.Screen name="Backup" component={BackupScreen} options={{ title: 'Backup' }} />
      <SettingsNav.Screen name="PeerSettings" component={PeerSettingsScreen} options={{ title: 'Peer Connection' }} />
    </SettingsNav.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: '#1f2937',
        },
        tabBarActiveTintColor: '#e11d48',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{ tabBarLabel: 'Wallet' }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatNavigator}
        options={{ tabBarLabel: 'Chat' }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsNavigator}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    async function check() {
      const hasKey = await SecureKeyStore.hasPrivateKey();
      setInitialRoute(hasKey ? 'MainTabs' : 'Onboarding');
    }
    check();
  }, []);

  if (!initialRoute) return null;

  return (
    <RootStack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
      <RootStack.Screen name="MainTabs" component={MainTabs} />
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <SaitoProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <RootNavigator />
      </NavigationContainer>
    </SaitoProvider>
  );
}
