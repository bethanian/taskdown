
// This file can be used to augment global types for GAPI if needed.
// However, with gapi-script and specific @types packages, direct augmentation might not be necessary.
// For example, @types/gapi.client.calendar-v3 provides types for gapi.client.calendar.

// If you encounter issues with `gapi.client.setToken`, you might need to extend the GAPI client type:
/*
declare namespace gapi.client {
  function setToken(token: { access_token: string } | null): void;
}
*/

// For Google Identity Services (accounts.google.com/gsi/client)
// The @react-oauth/google library abstracts this, but if using it directly:
/*
declare global {
  const google: {
    accounts: {
      id: {
        initialize: (config: any) => void;
        prompt: (callback: (notification: any) => void) => void;
        renderButton: (parentElement: HTMLElement, options: any) => void;
        // ... other methods
      };
      oauth2: {
        initTokenClient: (config: any) => {
          requestAccessToken: (overrideConfig?: any) => void;
        };
        // ... other methods
      };
    };
  };
}
*/
// Since we are using @react-oauth/google, specific GIS client types are less likely to be needed directly in our app code.
// The gapi.client types from @types/gapi.client.* should be sufficient.
export {}; // Ensure this file is treated as a module.
