
import type { Task } from '@/lib/types';
import { gapi } from 'gapi-script';
import { formatISO } from 'date-fns';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID; // Not directly used here but good for context

let gapiClientLoaded = false;

export const loadGapiClient = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (gapiClientLoaded && gapi.client?.calendar) {
      resolve();
      return;
    }
    if (!API_KEY) {
      console.error("Google API Key is not configured.");
      reject(new Error("Google API Key is not configured."));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      gapi.load('client', () => {
        gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
        })
        .then(() => {
          gapiClientLoaded = true;
          resolve();
        })
        .catch((error) => {
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
  if (!gapiClientLoaded || !gapi.client?.calendar) {
    await loadGapiClient(); // Ensure client is loaded
  }
  
  if (!gapi.client?.calendar) {
    throw new Error("Google Calendar API client not available.");
  }

  if (!task.dueDate) {
    throw new Error("Task must have a due date to be added to the calendar.");
  }

  gapi.client.setToken({ access_token: accessToken });

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
    const request = gapi.client.calendar.events.insert({
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
     gapi.client.setToken(null); // Clear token after use
  }
};
