// Copy this code into your Cloudflare Worker script

// This instruction stays on the server, so website visitors cannot replace it.
const systemPrompt = "You are the L'Oreal Beauty Assistant. Only answer questions about L'Oreal products, beauty routines, skincare, haircare, makeup, fragrance, and beauty recommendations. If a request is unrelated to these topics, politely explain that you can only help with L'Oreal and beauty-related questions.";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = env.OPENAI_API_KEY; // Make sure to name your secret OPENAI_API_KEY in the Cloudflare Workers dashboard
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    const userInput = await request.json();

    // Keep valid conversation turns and add the protected instruction.
    const conversationMessages = Array.isArray(userInput.messages)
      ? userInput.messages.filter((message) =>
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
        )
      : [];

    const requestBody = {
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationMessages,
      ],
      max_completion_tokens: 300,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  }
};
