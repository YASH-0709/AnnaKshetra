import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextValue {
  firebaseUser: User | null;
  idToken: string | null;
  loadingAuth: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  idToken: null,
  loadingAuth: true,
  authError: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshToken: async () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncUserWithBackend = useCallback(async (token: string) => {
    try {
      await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Non-fatal sync attempt
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setIdToken(token);
          await syncUserWithBackend(token);
        } catch {
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [syncUserWithBackend]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const token = await result.user.getIdToken();
      setIdToken(token);
      await syncUserWithBackend(token);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unable to complete Google Sign-In.';
      setAuthError(msg);
    }
  }, [syncUserWithBackend]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
      setIdToken(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to sign out.';
      setAuthError(msg);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    if (!firebaseUser) return null;
    try {
      const token = await firebaseUser.getIdToken(true);
      setIdToken(token);
      return token;
    } catch {
      return null;
    }
  }, [firebaseUser]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        idToken,
        loadingAuth,
        authError,
        signInWithGoogle,
        signOut,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
