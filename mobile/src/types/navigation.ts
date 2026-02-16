export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  CreateWallet: undefined;
  Restore: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Send: undefined;
  Receive: undefined;
};

export type ChatStackParamList = {
  ChatList: undefined;
  Chat: { groupId: string; name: string };
  NewChat: undefined;
  ChatSettings: { groupId: string };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  Backup: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  ChatTab: undefined;
  SettingsTab: undefined;
};
