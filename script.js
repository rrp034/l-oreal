/* DOM elements */
const categorySelect = document.getElementById("categorySelect");
const productSearch = document.getElementById("productSearch");
const productGrid = document.getElementById("productGrid");
const selectedProductsList = document.getElementById("selectedProductsList");
const selectedCount = document.getElementById("selectedCount");
const generateRoutineBtn = document.getElementById("generateRoutineBtn");
const clearSelectedBtn = document.getElementById("clearSelectedBtn");

const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// This is the secure Cloudflare Worker that calls OpenAI.
const workerUrl = "https://soft-glade-3b3b.rrp034.workers.dev/";
const selectedProductsStorageKey = "loreal-selected-product-ids";

// Shared assistant rules for routine follow-up and beauty-only topics.
const assistantScopePrompt = `You are a helpful L'Oreal beauty assistant.
Only answer questions about:
- the generated routine,
- skincare,
- haircare,
- makeup,
- fragrance,
- and closely related beauty topics.
If a user asks about unrelated topics, politely decline and redirect them to beauty or routine questions.`;

// App state for product data and user selections.
let products = [];
let selectedProducts = [];
let expandedProductIds = new Set();

// This array keeps the conversation context for the current browser session.
const conversationHistory = [];

// This stores routine context so future follow-up chat stays relevant.
let pendingRoutineContext = "";

// Read and validate assistant reply shape from Worker/OpenAI response.
function extractAssistantReply(data) {
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || reply.trim().length === 0) {
    throw new Error("Invalid response format from Worker.");
  }

  return reply;
}

// Create one message bubble inside the chat window.
function addMessageBubble(role, content) {
  const messageRow = document.createElement("div");
  const messageBubble = document.createElement("p");

  messageRow.className = `message-row ${role}`;
  messageBubble.className = "message-bubble";
  messageBubble.textContent = content;

  messageRow.appendChild(messageBubble);
  chatWindow.appendChild(messageRow);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Add category options based on the categories in products.json.
function populateCategoryDropdown() {
  const categories = [...new Set(products.map((product) => product.category))].sort();

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

// Render product cards based on the selected category.
function renderProducts() {
  productGrid.textContent = "";

  const filteredProducts = getFilteredProducts();

  if (filteredProducts.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "No products found in this category yet.";
    productGrid.appendChild(emptyMessage);
    return;
  }

  filteredProducts.forEach((product) => {
    const card = document.createElement("article");
    const isSelected = selectedProducts.some((item) => item.id === product.id);
    const isExpanded = expandedProductIds.has(product.id);
    const categoryLabel = formatLabel(product.category || "product");
    const concernLabel = product.concern ? formatLabel(product.concern) : "General Care";
    const productImage = product.image || "";
    const detailsId = `product-details-${product.id}`;

    card.className = `product-card ${isSelected ? "is-selected" : ""}`;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-pressed", String(isSelected));
    card.innerHTML = `
      ${
        productImage
          ? `<img class="product-image" src="${productImage}" alt="${product.name}" loading="lazy" />`
          : ""
      }
      <p class="product-brand">${product.brand}</p>
      <h3 class="product-name">${product.name}</h3>
      <p class="product-meta">${categoryLabel} • ${concernLabel}</p>
      <p class="product-description-preview">${getDescriptionPreview(product.description)}</p>
      <button
        type="button"
        class="details-toggle-btn"
        aria-expanded="${isExpanded ? "true" : "false"}"
        aria-controls="${detailsId}"
      >
        ${isExpanded ? "Hide Details" : "View Details"}
      </button>
      <div id="${detailsId}" class="product-details-panel" ${isExpanded ? "" : "hidden"}>
        <p class="product-description">${product.description}</p>
      </div>
      <button type="button" class="card-button ${isSelected ? "selected" : ""}">
        ${isSelected ? "Selected" : "Select Product"}
      </button>
    `;

    // Clicking anywhere on the card toggles product selection.
    card.addEventListener("click", () => {
      toggleProductSelection(product.id);
    });

    // Keyboard support for accessibility.
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleProductSelection(product.id);
      }
    });

    const cardButton = card.querySelector(".card-button");
    cardButton.addEventListener("click", (event) => {
      // Prevent double toggle when button click bubbles to the card.
      event.stopPropagation();
      toggleProductSelection(product.id);
    });

    const detailsToggleBtn = card.querySelector(".details-toggle-btn");
    detailsToggleBtn.addEventListener("click", (event) => {
      // Keep details interaction separate from card selection.
      event.stopPropagation();
      toggleProductDetails(product.id, detailsId, detailsToggleBtn);
    });

    const detailsPanel = card.querySelector(".product-details-panel");
    detailsPanel.addEventListener("click", (event) => {
      // Allow users to select and copy description text without selecting card.
      event.stopPropagation();
    });

    productGrid.appendChild(card);
  });
}

// Return products that match both the selected category and keyword search.
function getFilteredProducts() {
  const activeCategory = categorySelect.value;
  const keyword = productSearch.value.trim().toLowerCase();

  return products.filter((product) => {
    const matchesCategory = activeCategory === "all" || product.category === activeCategory;

    if (!matchesCategory) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.concern,
      product.description,
    ]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();

    return searchableText.includes(keyword);
  });
}

// Return a short preview so cards stay readable before expanding details.
function getDescriptionPreview(descriptionText) {
  const text = String(descriptionText || "").trim();
  if (text.length <= 120) {
    return text;
  }

  return `${text.slice(0, 120).trim()}...`;
}

// Toggle the details panel and remember each card's expanded/collapsed state.
function toggleProductDetails(productId, detailsId, toggleButton) {
  const panel = document.getElementById(detailsId);
  if (!panel) {
    return;
  }

  if (panel.hidden) {
    panel.hidden = false;
    expandedProductIds.add(productId);
    toggleButton.textContent = "Hide Details";
    toggleButton.setAttribute("aria-expanded", "true");
  } else {
    panel.hidden = true;
    expandedProductIds.delete(productId);
    toggleButton.textContent = "View Details";
    toggleButton.setAttribute("aria-expanded", "false");
  }
}

// Convert values such as "haircare" or "hair color" into readable labels.
function formatLabel(text) {
  return String(text)
    .split(" ")
    .map((word) => {
      return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : "";
    })
    .join(" ");
}

// Add or remove a product from the selected array.
function toggleProductSelection(productId) {
  const alreadySelected = selectedProducts.some((product) => product.id === productId);

  if (alreadySelected) {
    selectedProducts = selectedProducts.filter((product) => product.id !== productId);
  } else {
    const productToAdd = products.find((product) => product.id === productId);
    if (productToAdd) {
      selectedProducts.push(productToAdd);
    }
  }

  saveSelectedProductsToStorage();
  renderSelectedProducts();
  renderProducts();
}

// Save selected product IDs in localStorage to keep selections across reloads.
function saveSelectedProductsToStorage() {
  const selectedProductIds = selectedProducts.map((product) => product.id);
  localStorage.setItem(selectedProductsStorageKey, JSON.stringify(selectedProductIds));
}

// Read selected product IDs from localStorage and restore matching product objects.
function restoreSelectedProductsFromStorage() {
  const rawValue = localStorage.getItem(selectedProductsStorageKey);

  if (!rawValue) {
    selectedProducts = [];
    return;
  }

  try {
    const savedIds = JSON.parse(rawValue);
    if (!Array.isArray(savedIds)) {
      selectedProducts = [];
      return;
    }

    selectedProducts = savedIds
      .map((savedId) => {
        return products.find((product) => product.id === savedId);
      })
      .filter((product) => Boolean(product));
  } catch (error) {
    selectedProducts = [];
  }
}

// Clear all selected products and remove persisted selection state.
function clearAllSelectedProducts() {
  selectedProducts = [];
  localStorage.removeItem(selectedProductsStorageKey);
  renderSelectedProducts();
  renderProducts();
}

// Render the selected products section.
function renderSelectedProducts() {
  selectedProductsList.textContent = "";
  selectedCount.textContent = String(selectedProducts.length);
  generateRoutineBtn.disabled = selectedProducts.length === 0;
  clearSelectedBtn.disabled = selectedProducts.length === 0;

  if (selectedProducts.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "selected-item";
    emptyItem.innerHTML = "<p>Select products to build a routine.</p>";
    selectedProductsList.appendChild(emptyItem);
    return;
  }

  selectedProducts.forEach((product) => {
    const listItem = document.createElement("li");
    listItem.className = "selected-item";

    listItem.innerHTML = `
      <div>
        <p class="selected-brand">${product.brand}</p>
        <p class="selected-name">${product.name}</p>
      </div>
      <button type="button" class="remove-btn">Remove</button>
    `;

    const removeBtn = listItem.querySelector(".remove-btn");
    removeBtn.addEventListener("click", () => {
      toggleProductSelection(product.id);
    });

    selectedProductsList.appendChild(listItem);
  });
}

// Create plain text context from selected products.
function buildRoutineContext() {
  const lines = selectedProducts.map((product) => {
    return `- ${product.brand}: ${product.name} (${product.category})`;
  });

  return `The user selected these products for a routine:\n${lines.join("\n")}`;
}

// Build and send selected product JSON to the Worker for routine generation.
async function requestGeneratedRoutine() {
  const selectedProductData = selectedProducts.map((product) => {
    return {
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    };
  });

  const routinePrompt = `Create a personalized beauty routine using only these selected products.\n\nSelected products JSON:\n${JSON.stringify(
    selectedProductData,
    null,
    2,
  )}\n\nReturn:\n1) Morning routine\n2) Evening routine\n3) Short why-this-works summary.`;

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content:
            "Follow these rules: answer only beauty-related topics, and use only products from the provided JSON without inventing new products.",
        },
        {
          role: "user",
          content: routinePrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("The routine could not be generated.");
  }

  const data = await response.json();
  return extractAssistantReply(data);
}

// Generate a routine from selected products and show it in chat.
async function handleGenerateRoutineClick() {
  if (selectedProducts.length === 0) {
    addMessageBubble("assistant", "Please select at least one product first.");
    return;
  }

  generateRoutineBtn.disabled = true;
  const originalButtonText = generateRoutineBtn.textContent;
  generateRoutineBtn.textContent = "Generating...";

  addMessageBubble("assistant", "Generating your personalized routine now...");

  try {
    const routine = await requestGeneratedRoutine();

    // Save routine context so follow-up chat questions can use the latest routine.
    pendingRoutineContext = `${buildRoutineContext()}\n\nGenerated routine:\n${routine}`;

    // Store this turn in chat history so conversation can continue naturally.
    conversationHistory.push({
      role: "user",
      content: "Please generate a personalized routine from my selected products.",
    });
    conversationHistory.push({ role: "assistant", content: routine });

    addMessageBubble("assistant", routine);
  } catch (error) {
    addMessageBubble(
      "assistant",
      "Sorry, I could not generate a routine right now. Please try again.",
    );
  } finally {
    generateRoutineBtn.textContent = originalButtonText;
    generateRoutineBtn.disabled = selectedProducts.length === 0;
  }
}

// Load products from products.json and initialize the catalog UI.
async function initializeProductCatalog() {
  try {
    const response = await fetch("products.json");
    if (!response.ok) {
      throw new Error("Could not load products.");
    }

    const data = await response.json();
    products = Array.isArray(data) ? data : data.products || [];

    if (products.length === 0) {
      throw new Error("No products available.");
    }

    restoreSelectedProductsFromStorage();
    populateCategoryDropdown();
    renderProducts();
    renderSelectedProducts();
  } catch (error) {
    productGrid.textContent = "Could not load product data. Please refresh the page.";
  }
}

// Send a message to the Worker and return the assistant text reply.
async function getAssistantReply(userMessage) {
  // Start with scope instruction as a user turn because the Worker forwards user/assistant roles.
  const outgoingMessages = [
    {
      role: "user",
      content: `Assistant scope rules: ${assistantScopePrompt}`,
    },
  ];

  // Keep the generated routine context available for follow-up questions.
  if (pendingRoutineContext) {
    outgoingMessages.push({
      role: "user",
      content: `Routine context for follow-up questions:\n${pendingRoutineContext}`,
    });
  }

  // Include full chat history and newest user message.
  outgoingMessages.push(...conversationHistory);
  outgoingMessages.push({ role: "user", content: userMessage });

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: outgoingMessages,
    }),
  });

  if (!response.ok) {
    throw new Error("The assistant could not respond.");
  }

  const data = await response.json();
  return extractAssistantReply(data);
}

/* Event listeners */
categorySelect.addEventListener("change", (event) => {
  renderProducts();
});

productSearch.addEventListener("input", () => {
  renderProducts();
});

generateRoutineBtn.addEventListener("click", handleGenerateRoutineClick);
clearSelectedBtn.addEventListener("click", clearAllSelectedProducts);

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = userInput.value.trim();
  if (!message) {
    return;
  }

  // Show the user's message right away in the chat window.
  addMessageBubble("user", message);
  userInput.value = "";

  try {
    const reply = await getAssistantReply(message);

    // Save both sides of the conversation for future context.
    conversationHistory.push({ role: "user", content: message });
    conversationHistory.push({ role: "assistant", content: reply });

    addMessageBubble("assistant", reply);
  } catch (error) {
    addMessageBubble(
      "assistant",
      "Sorry, I could not connect right now. Please try again later.",
    );
  }
});

// Initial setup
addMessageBubble(
  "assistant",
  "Hello! Choose products, click Generate Routine, and ask me questions to continue.",
);
initializeProductCatalog();
