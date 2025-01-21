import OpenAI from 'openai';
import readlineSync from 'readline-sync';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SEARCH_API_KEY = process.env.SEARCH_API_KEY;
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID;

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

async function performSearch(query = '') {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}`
    );
    const items = response.data.items || [];
    if (items.length === 0) {
      return 'No results found.';
    }
    return items
      .slice(0, 3)
      .map((item, index) => `${index + 1}. ${item.title} - ${item.link}`)
      .join('\n');
  } catch {
    return 'Unable to perform the search.';
  }
}

const tools = {
  "performSearch": performSearch,
};

const SYSTEM_PROMPT = `
You are an AI Assistant with START, PLAN, ACTION, Observation, and Output State.
Wait for the user prompt and first PLAN using available tools.
After Planning, take the action with appropriate tools and wait for Observation based on Action.
Once you get the observations, return the AI response based on START prompt and observations.
Strictly follow the JSON output format to continue.

Available Tools:
- function performSearch(query: string): string
performSearch is a function that accepts a search query as a string and returns the top 3 search results.

Example:

START
{ "type": "user", "user": "What are the top 3 programming languages in 2025?" }

{ "type": "plan", "plan": "I will call performSearch for the query: 'top 3 programming languages in 2025'" }
{ "type": "action", "function": "performSearch", "input": "top 3 programming languages in 2025" }
{ "type": "observation", "observation": "1. Python - https://python.org\n2. JavaScript - https://javascript.com\n3. Rust - https://rust-lang.org" }

{ "type": "output", "output": "Here are the top 3 programming languages in 2025:\n1. Python - https://python.org\n2. JavaScript - https://javascript.com\n3. Rust - https://rust-lang.org" }
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
      const observation = await fn(parsedResult.input);
      const observationMessage = {
        type: 'observation',
        observation: observation,
      };

      messages.push({ role: 'developer', content: JSON.stringify(observationMessage) });
    }
  }
}
