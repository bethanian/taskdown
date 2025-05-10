
import type { Task } from '@/lib/types';
// import { gapi } from 'gapi-script'; // Removed to prevent SSR issues
import { formatISO } from 'date-fns';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID; // Not directly used here but good for context

let gapiClientLoaded = false;

export const loadGapiClient = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Ensure this runs only on the client
    if (typeof window === 'undefined') {
      // This function should not be called server-side.
      // If it is, it's an issue with how it's being invoked.
      // For now, resolve/reject to avoid breaking SSR if called inappropriately.
      // Ideally, callers ensure client-side execution.
      // console.warn("loadGapiClient called on server-side, this should not happen.");
      // resolve(); // Or reject, depending on desired behavior for incorrect SSR call
      return;
    }

    const gapiGlobal = (window as any).gapi;

    if (gapiClientLoaded && gapiGlobal?.client?.calendar) {
      resolve();
      return;
    }
    if (!API_KEY) {
      console.error("Google API Key is not configured.");
      reject(new Error("Google API Key is not configured."));
      return;
    }

    // Check if the script is already loaded to prevent duplicate script tags
    if (document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
        // If script tag exists but client not initialized, proceed to initialize
        if (gapiGlobal) {
            gapiGlobal.load('client', () => {
                gapiGlobal.client.init({
                apiKey: API_KEY,
                discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
                })
                .then(() => {
                gapiClientLoaded = true;
                resolve();
                })
                .catch((error: any) => {
                console.error('Error initializing GAPI client (script already present):', error);
                reject(error);
                });
            });
            return;
        }
    }


    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const gapiLoaded = (window as any).gapi;
      if (!gapiLoaded) {
        console.error('GAPI script loaded but window.gapi is not defined.');
        reject(new Error('GAPI script loaded but window.gapi is not defined.'));
        return;
      }
      gapiLoaded.load('client', () => {
        gapiLoaded.client.init({
          apiKey: API_KEY,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
        })
        .then(() => {
          gapiClientLoaded = true;
          resolve();
        })
        .catch((error: any) => {
          console.error('Error initializing GAPI client:', error);
          reject(error);
        });
      });
    };
    script.onerror = (error) => {
      console.error('Error loading GAPI script:', error);
      reject(error);
    };
    document.body.appendChild(script);
  });
};

export const addEventToCalendar = async (accessToken: string, task: Task, calendarId: string = 'primary'): Promise<any> => {
  if (typeof window === 'undefined') {
    throw new Error("addEventToCalendar cannot be called on the server-side.");
  }
  
  const gapiGlobal = (window as any).gapi;

  if (!gapiClientLoaded || !gapiGlobal?.client?.calendar) {
    await loadGapiClient(); // Ensure client is loaded
  }
  
  if (!gapiGlobal?.client?.calendar) { // Re-check after loadGapiClient
    throw new Error("Google Calendar API client not available after attempting to load.");
  }

  if (!task.dueDate) {
    throw new Error("Task must have a due date to be added to the calendar.");
  }

  gapiGlobal.client.setToken({ access_token: accessToken });

  const event = {
    summary: task.text,
    description: task.notes || '',
    start: {
      dateTime: formatISO(new Date(task.dueDate)), // Assumes dueDate is a timestamp
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Use user's local timezone
    },
    end: {
      dateTime: formatISO(new Date(task.dueDate + (60 * 60 * 1000))), // Assuming 1 hour duration for now
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    // Add other event properties as needed, e.g., recurrence
  };

  try {
    const request = gapiGlobal.client.calendar.events.insert({
      calendarId: calendarId,
      resource: event,
    });
    
    return new Promise((resolve, reject) => {
      request.execute((response: any) => {
        if (response.error) {
          console.error('Error creating calendar event:', response.error);
          reject(response.error);
        } else {
          console.log('Event created:', response);
          resolve(response);
        }
      });
    });

  } catch (error) {
    console.error("Error in addEventToCalendar:", error);
    throw error;
  } finally {
     if (gapiGlobal?.client) { // Check if client exists before trying to clear token
        gapiGlobal.client.setToken(null); // Clear token after use
     }
  }
};
