import OpenAI from 'openai';
import readlineSync from 'readline-sync';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPEN_API_KEY
const WEATHER_API_KEY = process.env.WEATHER_KEY

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
});


async function getWeatherDetails(city = '') {
  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`
    );
    const temperature = response.data.main.temp;
    return `${temperature}°C`; // Return temperature in Celsius.
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    return 'Unable to fetch weather data for this city.';
  }
}

const tools = {
  "getWeatherDetails": getWeatherDetails,
};

const SYSTEM_PROMPT = `
You are an AI Assistant with START, PLAN, ACTION, Observation, and Output State.
Wait for the user prompt and first PLAN using available tools.
After Planning, take the action with appropriate tools and wait for Observation based on Action.
Once you get the observations, return the AI response based on START prompt and observations.
Strictly follow the JSON output format to continue with Copilot.

Available Tools:
- function getWeatherDetails(city: string): string
getWeatherDetails is a function that accepts the city name as a string and returns the real-time weather.

Example:

START
{ "type": "user", "user": "What is the weather in Delhi?" }

{ "type": "plan", "plan": "I will call the getWeatherDetails for Delhi" }
{ "type": "action", "function": "getWeatherDetails", "input": "Delhi" }
{ "type": "observation", "observation": "12°C" }

{ "type": "output", "output": "The weather in Delhi is 12°C" }
`;

const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

while (true) {
  const query = readlineSync.question('> ');
  const userMessage = {
    type: 'user',
    user: query,
  };

  messages.push({ role: 'user', content: JSON.stringify(userMessage) });

  while (true) {
    const chat = await client.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      response_format: { type: 'json_object' },
    });

    const result = chat.choices[0].message.content;
    messages.push({ role: 'assistant', content: result });

    const parsedResult = JSON.parse(result);

    if (parsedResult.type === 'output') {
      console.log(`Output: ${parsedResult.output}`);
      break;
    } else if (parsedResult.type === 'action') {
      const functionName = parsedResult.function;
      const fn = tools[functionName];
      const observation = await fn(parsedResult.input); // Await the async function.
      const observationMessage = {
        type: 'observation',
        observation: observation,
      };

      messages.push({ role: 'developer', content: JSON.stringify(observationMessage) });
    }
  }
}
