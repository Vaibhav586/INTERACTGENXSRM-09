// popup.js
let recognizing = false;
let recognizer;

document.addEventListener("DOMContentLoaded", () => {
  const micBtn = document.getElementById("micBtn");
  const status = document.getElementById("status");
  const transcript = document.getElementById("transcript");
  const responseDiv = document.getElementById("response");
  const apiKeyInput = document.getElementById("apiKey");
  const saveKeyBtn = document.getElementById("saveKey");

  // load saved key
  chrome.storage.local.get(["GROQ_KEY"], data => {
    if (data.GROQ_KEY) apiKeyInput.value = data.GROQ_KEY;
  });

  saveKeyBtn.onclick = () => {
    const k = apiKeyInput.value.trim();
    chrome.storage.local.set({GROQ_KEY: k}, ()=> {
      status.innerText = "Groq API key saved";
    });
  };

  // quick action buttons
  document.querySelectorAll(".qa").forEach(b => {
    b.addEventListener("click", () => {
      const cmd = b.dataset.cmd;
      runVoiceCommand(cmd);
    });
  });

  // mic toggle
  micBtn.onclick = () => {
    if (recognizing) stopRecognition();
    else startRecognition();
  };

  // speech recognition
  function startRecognition() {
    // webkitSpeechRecognition for Chrome
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      status.innerText = "SpeechRecognition not supported in this browser.";
      return;
    }
    recognizer = new SpeechRecognition();
    recognizer.lang = "en-US";
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.onstart = () => { recognizing = true; status.innerText = "Listening..."; micBtn.innerText = "🔴 Listening"; };
    recognizer.onend = () => { recognizing = false; status.innerText = "Idle"; micBtn.innerText = "🎤 Start Listening"; };
    recognizer.onerror = (e)=> { status.innerText = "Recognition error: " + e.error; recognizing = false; micBtn.innerText = "🎤 Start Listening"; };
    recognizer.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      transcript.innerText = text;
      runVoiceCommand(text);
    };
    recognizer.start();
  }

  function stopRecognition() {
    if (recognizer) recognizer.stop();
    recognizing = false;
    status.innerText = "Idle";
  }

  async function runVoiceCommand(text) {
    status.innerText = "Processing...";
    transcript.innerText = text;
    // ask active tab for snapshot
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    chrome.tabs.sendMessage(tab.id, {type: "GET_SNAPSHOT"}, async (snapRes) => {
      const snapshot = snapRes?.snapshot ?? {url: tab.url, title: tab.title};
      // send to background for LLM call
      chrome.runtime.sendMessage({type: "AI_REQUEST", command: text, snapshot}, (aiRes) => {
        if (!aiRes || !aiRes.ok) {
          responseDiv.innerText = "AI error: " + (aiRes?.err || "unknown");
          status.innerText = "Idle";
          return;
        }
        const ai = aiRes.ai;
        // if action -> route to content script
        if (ai.responseType === "action") {
          chrome.tabs.sendMessage(tab.id, {type:"EXECUTE_ACTION", action: ai}, (execRes) => {
            responseDiv.innerText = "Executed action: " + JSON.stringify(ai);
            // if ai provided text to say
            if (ai.text) speak(ai.text);
            status.innerText = "Idle";
          });
        } else if (ai.responseType === "reply") {
          responseDiv.innerText = ai.text;
          speak(ai.text);
          status.innerText = "Idle";
        } else {
          // fallback: show full ai
          responseDiv.innerText = JSON.stringify(ai, null, 2);
          if (ai.text) speak(ai.text);
          status.innerText = "Idle";
        }
      });
    });
  }

  function speak(text) {
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
});
