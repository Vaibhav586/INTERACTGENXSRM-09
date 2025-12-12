// service_worker.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("InteractAI background installed");
});

// helper to call Groq API (chat completion). Uses stored key in chrome.storage.
async function callGroq(promptPayload) {
  const key = await new Promise(resolve => chrome.storage.local.get(["GROQ_KEY"], data => resolve(data.GROQ_KEY)));
  if (!key) throw new Error("No Groq API key set. Save it in the popup.");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: promptPayload,
      max_tokens: 1024,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error("Groq API error: " + t);
  }
  const j = await response.json();
  return j.choices?.[0]?.message?.content ?? JSON.stringify(j);
}

// Widely used prompt template — instruct model to return either a JSON action or a plain text reply
function buildMessages(userCommand, pageSnapshot) {
  const system = `You are InteractAI Voice, an AI agent that controls and interprets any webpage through voice commands. 
You ALWAYS respond in valid JSON ONLY, with no additional text, explanations, or markdown. 

You will be given a DOM snapshot of the webpage and a user voice command. Based on the command, choose ONE of the following response formats:

1) ACTION RESPONSE:
{
  "responseType": "action",
  "action": "scrollTo" | "highlight" | "click" | "reply" | "extract",
  "selector": "<CSS selector if available>",
  "text": "<optional text for fallback search or speech>"
}

2) TEXT REPLY:
{
  "responseType": "reply",
  "text": "<your answer to the user>"
}

Rules:
- ALWAYS return pure JSON, never prose before or after it.
- For actions involving navigation (pricing, contact, about), return the best CSS selector you can infer (e.g., "a[href*='contact']", "h2").
- If no selector is reliable, use "text" for fuzzy matching in the content script.
- For summarization or explanations, use "responseType": "reply".
- For reading aloud, return:
{
  "responseType": "action",
  "action": "reply",
  "text": "<text to speak>"
}
- Be concise, accurate, and deterministic.

Page snapshot:
${JSON.stringify(pageSnapshot, null, 2)}

User command: ${userCommand}`;

  return [
    {role: "system", content: system},
    {role: "user", content: `Command: ${userCommand}`}
  ];
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "AI_REQUEST") {
    (async () => {
      try {
        const messages = buildMessages(msg.command, msg.snapshot);
        const res = await callGroq(messages);
        // parse JSON
        let json;
        try { json = JSON.parse(res); } catch (e) {
          // fallback: model returned plain text -> wrap it
          json = {responseType:"reply", text: res};
        }
        sendResponse({ok:true, ai: json});
      } catch (err) {
        sendResponse({ok:false, err: err.toString()});
      }
    })();
    return true; // async
  }
});
