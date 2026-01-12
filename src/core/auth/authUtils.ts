// authUtils.ts - Utility functions for authentication handling
import { removeSecureItem } from '../storage/secureStorage';
import { StorageKeys } from '../storage/keys';
import { setSessionToken } from '../auth/session';

// Handle token expiration - logout user and terminate voice sessions
export async function handleTokenExpiration(): Promise<void> {
  // Clear stored tokens
  await removeSecureItem(StorageKeys.authToken);
  await removeSecureItem(StorageKeys.authUser);
  setSessionToken(null);

  // Dynamically import stores to avoid circular dependencies
  try {
    const { useAuthStore } = await import('../../features/auth/store/useAuthStore');
    const { useVoiceStore } = await import('../../features/voice/store/useVoiceStore');

    // Update auth store
    useAuthStore.getState().setToken(null);
    useAuthStore.getState().setAuthStatus('anonymous');

    // Terminate voice session
    const voiceStore = useVoiceStore.getState();
    if (voiceStore.sessionId) {
      voiceStore.clear();
    }
  } catch (error) {
    console.error('Error handling token expiration:', error);
  }
}