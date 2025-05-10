import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This is the core Genkit AI configuration.
// For production, ensure that the GOOGLE_API_KEY (or equivalent, like GOOGLE_GENERATIVE_AI_API_KEY)
// environment variable is set in your deployment environment.
export const ai = genkit({
  plugins: [
    googleAI(), // The googleAI plugin will automatically use the API key from the environment.
  ],
  // Ensure 'googleai/gemini-2.0-flash' is the desired model for your production needs.
  // You might consider other models based on cost, performance, or capabilities.
  model: 'googleai/gemini-2.0-flash',
});
