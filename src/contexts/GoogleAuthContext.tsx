
"use client";

import type { TokenResponse } from '@react-oauth/google';
import { useGoogleLogin } from '@react-oauth/google';
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { CredentialResponse } from '@react-oauth/google';

// Define the shape of the context
interface GoogleAuthContextType {
  accessToken: string | null;
  profile: any | null; // Consider defining a stricter type for profile
  isSignedIn: boolean;
  login: () => void;
  logout: () => void;
  isLoading: boolean;
}

// Create the context
const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

// Define the props for the provider
interface GoogleAuthProviderProps {
  children: ReactNode;
}

export const GoogleAuthProvider: React.FC<GoogleAuthProviderProps> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start with loading true

  const fetchProfile = useCallback(async (token: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setProfile(null); // Clear profile on error
    }
  }, []);

  // Effect to check for existing token in localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('googleAccessToken');
    const storedProfile = localStorage.getItem('googleProfile');
    if (storedToken) {
      setAccessToken(storedToken);
      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
      } else {
        fetchProfile(storedToken); // Fetch profile if token exists but profile doesn't
      }
    }
    setIsLoading(false); // Done loading initial state
  }, [fetchProfile]);

  const handleLoginSuccess = useCallback(
    async (tokenResponse: Omit<TokenResponse, 'error' | 'error_description' | 'error_uri'>) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem('googleAccessToken', tokenResponse.access_token);
      await fetchProfile(tokenResponse.access_token);
    },
    [fetchProfile]
  );

  const login = useGoogleLogin({
    onSuccess: handleLoginSuccess,
    onError: (errorResponse) => {
      console.error('Google Login Failed:', errorResponse);
      setAccessToken(null);
      setProfile(null);
      localStorage.removeItem('googleAccessToken');
      localStorage.removeItem('googleProfile');
    },
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.profile', // Added profile scope
  });
  
  // Save profile to localStorage when it changes
  useEffect(() => {
    if (profile) {
      localStorage.setItem('googleProfile', JSON.stringify(profile));
    } else {
      localStorage.removeItem('googleProfile');
    }
  }, [profile]);


  const logout = useCallback(() => {
    setAccessToken(null);
    setProfile(null);
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleProfile');
    // Note: @react-oauth/google doesn't have a direct programmatic logout function for `useGoogleLogin`
    // The token simply expires or is removed from state.
    // If needed, can use `googleLogout()` from the library if using the <GoogleLogin /> button.
    // For `useGoogleLogin`, revoking token can be done manually via API if necessary:
    // if (accessToken) {
    //   fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, { method: 'POST'})
    //     .catch(err => console.error("Token revocation error", err));
    // }
  }, []);

  return (
    <GoogleAuthContext.Provider value={{ accessToken, profile, isSignedIn: !!accessToken, login, logout, isLoading }}>
      {children}
    </GoogleAuthContext.Provider>
  );
};

// Custom hook to use the GoogleAuthContext
export const useGoogleAuth = (): GoogleAuthContextType => {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
};
