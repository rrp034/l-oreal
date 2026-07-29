/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// This is the secure Cloudflare Worker that calls OpenAI.
const workerUrl = "https://soft-glade-3b3b.rrp034.workers.dev/";

// This array keeps the conversation context for the current browser session.
const conversationHistory = [];

// Create one message bubble inside the chat window.
function addMessageBubble(role, content) {
  const messageRow = document.createElement("div");
  const messageBubble = document.createElement("p");

  messageRow.className = `message-row ${role}`;
  messageBubble.className = "message-bubble";
  messageBubble.textContent = content;

  messageRow.appendChild(messageBubble);
  chatWindow.appendChild(messageRow);
}

// Show only the newest question and answer in the chat window.
function showLatestConversation(question, answer) {
  chatWindow.textContent = "";
  addMessageBubble("user", question);
  addMessageBubble("assistant", answer);
}

// Set initial assistant message.
addMessageBubble("assistant", "Hello! How can I help with your L'Oreal beauty routine?");

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();

  if (!message) {
    return;
  }

  // Save the user's message before asking the assistant for a reply.
  conversationHistory.push({ role: "user", content: message });

  // Show the latest question in its own bubble while the reply is loading.
  showLatestConversation(message, "Thinking...");
  userInput.value = "";

  try {
    // Send every previous turn so the assistant can use the conversation context.
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversationHistory,
      }),
    });

    if (!response.ok) {
      throw new Error("The assistant could not respond.");
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Save the reply so it is included with the next question.
    conversationHistory.push({ role: "assistant", content: reply });
    showLatestConversation(message, reply);
  } catch (error) {
    showLatestConversation(
      message,
      "Sorry, I could not connect right now. Please try again later.",
    );
  }
});
