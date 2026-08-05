// Copy this code into your Cloudflare Worker script

// This instruction stays on the server, so website visitors cannot replace it.
const systemPrompt = "You are the L'Oreal Beauty Assistant. Only answer questions about L'Oreal products, beauty routines, skincare, haircare, makeup, fragrance, and beauty recommendations. If a request is unrelated to these topics, politely explain that you can only help with L'Oreal and beauty-related questions.";

function buildInputMessages(messages) {
  const safeMessages = Array.isArray(messages)
    ? messages.filter((message) => {
        return (
          (message.role === "user" || message.role === "assistant" || message.role === "system") &&
          typeof message.content === "string"
        );
      })
    : [];

  return [
    {
      role: "system",
      content: [{ type: "input_text", text: systemPrompt }],
    },
    ...safeMessages.map((message) => {
      return {
        role: message.role,
        content: [{ type: "input_text", text: message.content }],
      };
    }),
  ];
}

function extractReplyAndSources(responseData) {
  let replyText = typeof responseData.output_text === "string" ? responseData.output_text.trim() : "";
  const citations = [];

  if (Array.isArray(responseData.output)) {
    responseData.output.forEach((item) => {
      if (!Array.isArray(item.content)) {
        return;
      }

      item.content.forEach((contentPart) => {
        if (!replyText && typeof contentPart.text === "string" && contentPart.text.trim()) {
          replyText = contentPart.text.trim();
        }

        if (!Array.isArray(contentPart.annotations)) {
          return;
        }

        contentPart.annotations.forEach((annotation) => {
          if (annotation.type === "url_citation" && typeof annotation.url === "string") {
            citations.push({
              title: annotation.title || annotation.url,
              url: annotation.url,
            });
          }
        });
      });
    });
  }

  const uniqueCitations = citations.filter((citation, index, array) => {
    return array.findIndex((item) => item.url === citation.url) === index;
  });

  if (uniqueCitations.length > 0) {
    const sourcesList = uniqueCitations
      .map((citation, index) => {
        return `${index + 1}. ${citation.title} - ${citation.url}`;
      })
      .join("\n");

    replyText = `${replyText}\n\nSources:\n${sourcesList}`;
  }

  return {
    replyText: replyText || "I could not generate a response right now.",
    citations: uniqueCitations,
  };
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight requests.
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const apiKey = env.OPENAI_API_KEY; // Store this as a Worker secret.
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "OPENAI_API_KEY secret is missing." }),
          { status: 500, headers: corsHeaders },
        );
      }

      const userInput = await request.json();
      const responseBody = {
        model: "gpt-4.1",
        input: buildInputMessages(userInput.messages),
        tools: [{ type: "web_search_preview" }],
        tool_choice: "auto",
        max_output_tokens: 900,
      };

      const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(responseBody),
      });

      const responseData = await openAiResponse.json();

      if (!openAiResponse.ok) {
        return new Response(JSON.stringify(responseData), {
          status: openAiResponse.status,
          headers: corsHeaders,
        });
      }

      // Keep a chat-completions-like response shape for existing frontend code.
      const parsed = extractReplyAndSources(responseData);
      const normalizedResponse = {
        id: responseData.id || `resp_${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: responseData.model || "gpt-4.1",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: parsed.replyText,
            },
            finish_reason: "stop",
          },
        ],
        citations: parsed.citations,
      };

      return new Response(JSON.stringify(normalizedResponse), { headers: corsHeaders });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Worker request failed.", details: String(error) }),
        { status: 500, headers: corsHeaders },
      );
    }
  },
};
