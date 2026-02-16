import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let isBackground = false;

AppState.addEventListener('change', (state: AppStateStatus) => {
  isBackground = state !== 'active';
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('saito_chat', {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

/**
 * Show a local notification for a new chat message.
 */
export async function showChatNotification(
  sender: string,
  message: string,
  groupId: string,
): Promise<void> {
  if (!isBackground) return;

  try {
    await ensureChannel();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Message from ${sender.slice(0, 8)}...`,
        body: message.length > 100 ? message.slice(0, 100) + '...' : message,
        data: { groupId },
        ...(Platform.OS === 'android' ? { channelId: 'saito_chat' } : {}),
      },
      trigger: null,
    });
  } catch {
    // notifications not available — silent fallback
  }
}
