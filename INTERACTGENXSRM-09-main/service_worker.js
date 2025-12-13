console.log("🚀 InteractAI service worker starting...");

// Track active requests to prevent duplicates
const activeRequests = new Set();

/**
 * Installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
	console.log("✅ InteractAI installed/updated", details.reason);

	if (details.reason === "install") {
		console.log("🎉 First time installation!");

		// Set default settings
		chrome.storage.local.set({
			settings: {
				autoSpeak: false,
				highlightDuration: 5000,
				maxTokens: 150 // Increased tokens for better AI replies
			}
		});
	} else if (details.reason === "update") {
		console.log("🔄 Extension updated to version", chrome.runtime.getManifest().version);
	}
});

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	console.log("📨 Service worker received message:", msg.type);

	// Handle AI requests
	if (msg.type === "AI_REQUEST") {
		handleAIRequest(msg, sendResponse);
		return true; // Keep channel open for async response
	}
  if (msg.type === "BROWSER_ACTION") {
        handleBrowserAction(msg, sendResponse);
        return true; 
    }

	// Handle API key validation
	if (msg.type === "VALIDATE_API_KEY") {
		validateAPIKey(msg.key, sendResponse);
		return true;
	}

	// Get extension info
	if (msg.type === "GET_INFO") {
		sendResponse({
			version: chrome.runtime.getManifest().version,
			name: chrome.runtime.getManifest().name
		});
		return false;
	}

	return false;
});
async function handleBrowserAction(msg, sendResponse) {
    const action = msg.action;

    if (action.action === "search") {
        const query = action.text.trim();
        if (!query) {
            sendResponse({ success: false, message: "Search query is empty." });
            return;
        }

        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        
        try {
            await chrome.tabs.create({ url: url });
            sendResponse({ success: true, message: `Searching Google for "${query}" in a new tab.` });
        } catch (error) {
            console.error("Error creating search tab:", error);
            sendResponse({ success: false, message: `Failed to open search tab: ${error.message}` });
        }
    } else {
        sendResponse({ success: false, message: `Unsupported browser action: ${action.action}` });
    }
}

/**
 * Handle AI request with proper error handling
 */
async function handleAIRequest(msg, sendResponse) {
	const requestId = `${Date.now()}-${Math.random()}`;

	// Prevent duplicate requests
	if (activeRequests.has(msg.command)) {
		sendResponse({
			ok: false,
			error: "Request already in progress"
		});
		return;
	}

	activeRequests.add(msg.command);

	try {
		// Get API key and max tokens setting
		const data = await chrome.storage.local.get(["HF_KEY", "settings"]);
		const key = data.HF_KEY;
		const maxTokens = data.settings?.maxTokens || 150;

		if (!key || !key.trim() || !key.startsWith("hf_")) {
			throw new Error("Invalid API key. Please save your Hugging Face API key first.");
		}

		console.log("🤖 Making AI request:", {
			command: msg.command?.substring(0, 50) + "...",
			snapshotSize: JSON.stringify(msg.snapshot).length
		});

		// Prepare prompt
		const prompt = buildPrompt(msg.command, msg.snapshot);
		
		const url = "https://router.huggingface.co/v1/chat/completions"; 

		// Call Hugging Face API
		const response = await fetchWithTimeout(url, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${key}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "meta-llama/Llama-3.2-1B-Instruct", // Reliable, small model for speed
				messages: [{ role: "user", content: prompt }],
				max_tokens: maxTokens,
				temperature: 0.7
			})
		}, 30000);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("❌ API error:", response.status, errorText);

			if (response.status === 401) {
				throw new Error("Invalid API key. Please check your Hugging Face API key.");
			} else if (response.status === 429) {
				throw new Error("Rate limit exceeded. Please wait a moment and try again.");
			} else if (response.status === 503) {
				throw new Error("Model is loading. Please wait 20 seconds and try again.");
			} else {
				throw new Error(`API error (${response.status}): ${errorText}`);
			}
		}

		const result = await response.json();
		
		if (result.error) {
			throw new Error(result.error);
		}
		
		// Extract response text from chat completion format
		const replyText = result.choices?.[0]?.message?.content?.trim() || "Command processed successfully.";
		console.log("✅ AI raw response:", replyText);


		// Parse potential actions from AI response
		const actions = parseActionsFromResponse(replyText, msg.command);

		sendResponse({
			ok: true,
			ai: {
				responseType: actions.length > 0 ? "action" : "reply",
				text: replyText.replace(/^ACTION:(HIGHLIGHT|SCROLL|CLICK|NAVIGATE):.+/i, '').trim(), // Clean reply text if action was found
				actions: actions
			}
		});

	} catch (error) {
		console.error("❌ Error in AI request:", error);

		sendResponse({
			ok: false,
			error: error.message || "Unknown error occurred",
			details: error.toString()
		});

	} finally {
		activeRequests.delete(msg.command);
	}
}

/**
 * Build optimized prompt for AI, instructing on action output format.
 */
function buildPrompt(command, snapshot) {
    const lowerCommand = command.toLowerCase();
    
    // Check if the command is definitely a search action
    const isSearchCommand = lowerCommand.startsWith('search for') || lowerCommand.startsWith('google');

    // Detect general potential action commands to guide the AI
    const actionKeywords = ['highlight', 'find', 'show me', 'scroll to', 'go to', 'click', 'press', 'add to cart', 'buy', 'orders', 'address', 'payment', 'profile', 'logout'];
    const needsAction = isSearchCommand || actionKeywords.some(keyword => lowerCommand.includes(keyword));

    // System message to guide the AI's output format
    const systemPrompt = `You are an intelligent web assistant. Your primary goal is to execute the user's command.

    ***CRITICAL INSTRUCTION***
    - If the user explicitly asks to 'search' or 'google' something (e.g., "search for a bottle"), you MUST output: 'ACTION:SEARCH:The user's query'. Do not analyze the page.
    - For webpage interaction (highlight, scroll, click, navigate), output the corresponding ACTION token: ACTION:HIGHLIGHT:, ACTION:SCROLL:, ACTION:CLICK:, ACTION:NAVIGATE:.
    - For all other requests (summarize, answer a question), provide a concise text reply without any ACTION: prefix.
    
    Be concise in your responses.`;

    const userPrompt = `
    Webpage Context:
    Title: ${snapshot.title}
    URL: ${snapshot.url}
    Content Snippet (first 1000 chars): ${content}

    User Command: ${command}
    `;

    // The AI should use the prompt structure: [System Prompt] + [User Prompt]
    return systemPrompt + "\n\n" + userPrompt;
}

/**
 * Parse actions from AI response, looking for the ACTION: token.
 */
// service_worker.js: parseActionsFromResponse function (full view)

function parseActionsFromResponse(response, command) {
	const actions = [];
	
    // ADDED 'SEARCH' to the regex
	const match = response.match(/^ACTION:(HIGHLIGHT|SCROLL|CLICK|NAVIGATE|SEARCH):(.+)/i);
    
    if (match) {
        const actionType = match[1].toLowerCase();
        const actionText = match[2].trim();
        
        // ADDED 'search' to the array of allowed actions
        if (["highlight", "scroll", "click", "navigate", "search"].includes(actionType)) {
            actions.push({ 
                action: actionType, 
                text: actionText 
            });
        }
    }
	
	// --- Fallback/Special Case (Reading) ---
    // Since the content script handles "read aloud" directly, check the command only
    if (actions.length === 0 && command.toLowerCase().includes("read") && command.toLowerCase().includes("aloud")) {
        actions.push({ action: "read", text: "main content" });
    }

	return actions;
}

/**
 * Fetch with timeout
 */
function fetchWithTimeout(url, options, timeout = 30000) {
	return Promise.race([
		fetch(url, options),
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error("Request timeout")), timeout)
		)
	]);
}

/**
 * Validate API key by making a test request
 */
async function validateAPIKey(key, sendResponse) {
	try {
		if (!key || !key.trim()) {
			sendResponse({ valid: false, error: "API key is empty" });
			return;
		}

		if (!key.startsWith("hf_")) {
			sendResponse({ valid: false, error: "API key should start with 'hf_'" });
			return;
		}

		// Test the key with a minimal request
		const response = await fetchWithTimeout(
			"https://api-inference.huggingface.co/models/gpt2",
			{
				method: "POST",
				headers: {
					"Authorization": `Bearer ${key}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					inputs: "test",
					parameters: { max_new_tokens: 5 }
				})
			},
			10000
		);

		if (response.ok) {
			sendResponse({ valid: true, message: "API key is valid" });
		} else if (response.status === 401) {
			sendResponse({ valid: false, error: "Invalid API key" });
		} else {
			sendResponse({ valid: false, error: `Validation failed: ${response.status}` });
		}

	} catch (error) {
		console.error("Error validating API key:", error);
		sendResponse({ 
			valid: false, 
			error: "Unable to validate key: " + error.message 
		});
	}
}

/**
 * Handle extension errors
 */
self.addEventListener('error', (event) => {
	console.error('🔥 Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
	console.error('🔥 Unhandled promise rejection:', event.reason);
});

console.log("✅ InteractAI service worker ready!");