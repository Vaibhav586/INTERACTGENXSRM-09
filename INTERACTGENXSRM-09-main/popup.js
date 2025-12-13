// popup.js - FINAL VERSION

let recognizing = false;
let recognizer;

document.addEventListener("DOMContentLoaded", () => {
    // DOM elements
    const micBtn = document.getElementById("micBtn");
    const micText = document.getElementById("micText");
    const status = document.getElementById("status");
    const transcript = document.getElementById("transcript");
    const responseDiv = document.getElementById("response");
    const apiKeyInput = document.getElementById("apiKey");
    const saveKeyBtn = document.getElementById("saveKey");
    const toggleKeyBtn = document.getElementById("toggleKey");
    const keyStatus = document.getElementById("keyStatus");
    const loader = document.getElementById("loader");

    // --- 1. API Key Management ---

    // Load saved HF API key
    chrome.storage.local.get(["HF_KEY"], data => {
      if (data.HF_KEY) {
        apiKeyInput.value = data.HF_KEY;
        keyStatus.textContent = "✓ API key loaded";
        keyStatus.classList.remove("error");
        keyStatus.classList.add("success");
      }
    });

    // Save API key
    saveKeyBtn.onclick = () => {
      const key = apiKeyInput.value.trim();
      if (!key || !key.startsWith("hf_")) {
        keyStatus.textContent = "⚠ Please enter a valid Hugging Face API key starting with 'hf_'";
        keyStatus.classList.remove("success");
        keyStatus.classList.add("error");
        return;
      }
      
      chrome.storage.local.set({HF_KEY: key}, () => {
        updateStatus("API key saved successfully!", "success");
        keyStatus.textContent = "✓ API key saved";
        keyStatus.classList.remove("error");
        keyStatus.classList.add("success");
      });
    };

    // Toggle API key visibility
    if (toggleKeyBtn) {
      toggleKeyBtn.onclick = () => {
        if (apiKeyInput.type === "password") {
          apiKeyInput.type = "text";
          toggleKeyBtn.textContent = "🙈";
        } else {
          apiKeyInput.type = "password";
          toggleKeyBtn.textContent = "👁️";
        }
      };
    }

    // --- 2. Quick Action Buttons ---
    
    document.querySelectorAll(".qa").forEach(btn => {
      btn.addEventListener("click", () => {
        const cmd = btn.dataset.cmd;
        let command = "";
        
        // Map quick action button to a natural language command for the AI
        switch(cmd) {
          case "summarize":
            command = "Summarize this page in 3 sentences, focusing on the main topic.";
            break;
          case "pricing":
            command = "Highlight the pricing on this page.";
            break;
          case "contacts":
            command = "Find and show me the contact information.";
            break;
          case "read":
            command = "Read the main content of this page aloud.";
            break;
          default:
            command = cmd;
        }
        
        runVoiceCommand(command);
      });
    });

    // --- 3. Speech Recognition Setup ---

    // Mic toggle
    micBtn.onclick = () => {
      if (recognizing) {
        stopRecognition();
      } else {
        startRecognition();
      }
    };

    function startRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        updateStatus("Speech recognition not supported", "error");
        responseDiv.textContent = "Please use Chrome, Edge, or Safari for voice recognition.";
        return;
      }

      recognizer = new SpeechRecognition();
      recognizer.lang = "en-US";
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 1;

      recognizer.onstart = () => {
        recognizing = true;
        updateStatus("Listening... Speak your command", "listening");
        micBtn.classList.add("listening");
        if (micText) micText.textContent = "Stop Listening";
        transcript.textContent = "";
        responseDiv.textContent = "";
      };

      recognizer.onresult = (event) => {
        const text = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        transcript.textContent = `"${text}" (${Math.round(confidence * 100)}% confidence)`;
        updateStatus("Processing your command...", "processing");
        
        runVoiceCommand(text);
      };

      recognizer.onerror = (e) => {
        console.error("Speech recognition error:", e);
        let errorMsg = e.error === "no-speech" ? "No speech detected. Please try again." : `Recognition error: ${e.error}`;
        updateStatus(errorMsg, "error");
        stopRecognition(); // Stop on error
      };

      recognizer.onend = () => {
        // If the status is still 'Listening...' it means the user stopped without speaking.
        if (recognizing) {
            recognizing = false;
            micBtn.classList.remove("listening");
            if (micText) micText.textContent = "Start Listening";
        }
        
        if (status.textContent === "Listening... Speak your command") {
          updateStatus("Idle", "idle");
        }
      };

      try {
        recognizer.start();
      } catch (err) {
        console.error("Failed to start recognition:", err);
        updateStatus("Failed to start microphone", "error");
      }
    }

    function stopRecognition() {
      if (recognizer) {
        recognizer.stop();
      }
      recognizing = false;
      micBtn.classList.remove("listening");
      if (micText) micText.textContent = "Start Listening";
      updateStatus("Idle", "idle");
    }

    // --- 4. Main Execution Flow ---

    async function runVoiceCommand(text) {
      if (!text || !text.trim()) return;
      
      updateStatus("Processing your command...", "processing");
      transcript.textContent = `Command: "${text}"`;
      responseDiv.textContent = "";
      showLoader(true);

      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!tab || tab.url.startsWith('chrome')) {
          throw new Error("Cannot interact with browser internal pages.");
        }

        // 1. Get snapshot from Content Script (and ensure it's injected)
        const snapRes = await sendMessageWithRetry(tab.id, {type: "GET_SNAPSHOT"});
        const snapshot = snapRes?.snapshot;

        if (!snapshot || snapshot.error) {
           throw new Error(snapshot?.error || "Failed to get page content snapshot. Try refreshing the page.");
        }

        // 2. Send command and snapshot to Service Worker for AI processing
        updateStatus("Waiting for AI response...", "processing");
        
        const aiRes = await chrome.runtime.sendMessage({
            type: "AI_REQUEST",
            command: text,
            snapshot: snapshot
        });
        
        if (!aiRes.ok) {
            throw new Error(aiRes.error || "AI service failed to respond.");
        }
        
        const aiResult = aiRes.ai;

        // 3. Handle Actions or Replies
        
if (aiResult.actions.length > 0) {
    // --- A. Execute Web Actions ---
    updateStatus("Executing Web Action...", "processing");
    
    const action = aiResult.actions[0];
    responseDiv.textContent = `Action requested: ${action.action} "${action.text}"`;
    
    let actionResult = { success: false, message: "Action handler failed." };
  
    if (action.action === "search") {
        // 1. Browser-level Action: Handled by Service Worker
        actionResult = await chrome.runtime.sendMessage({
            type: "BROWSER_ACTION",
            action: action
        });

    } else if (action.action === "read") {
        // 2. TTS Action: Handled by Content Script (to get text) then Popup (to speak)
        const readResult = await sendMessageWithRetry(tab.id, {
            type: "EXECUTE_ACTION", 
            action: { action: "read", text: "" } // Send minimal action to content.js
        });
        
        if (readResult.success) {
            speak(readResult.text);
            actionResult.success = true;
            actionResult.message = `Reading the main page content (${readResult.text.length} characters)...`;
        } else {
            actionResult.message = `Read failed: ${readResult.message}`;
        }
        
    } else {
        // 3. DOM Actions (highlight, scroll, click, navigate): Handled by Content Script
        actionResult = await sendMessageWithRetry(tab.id, {
            type: "EXECUTE_ACTION", 
            action: action
        });
    }

    // Update the final status based on the action result
    responseDiv.textContent = actionResult.message;
    
    if (action.action === 'read' && actionResult.success) {
        // TTS logic handles its own status update (start/end)
        updateStatus("Speaking...", "listening"); 
    } else if (actionResult.method === 'redirect' || actionResult.method === 'click' || action.action === 'search') {
        // Actions that change the page/tab
        updateStatus("Action Complete (Navigating)", "success");
    } else {
        // Standard DOM actions (highlight/scroll)
        updateStatus("Action Complete", actionResult.success ? "success" : "error");
    }
            
        } else {
            // --- B. Display Text Reply ---
            const finalReply = aiResult.text;
            responseDiv.textContent = finalReply;
            updateStatus("Complete!", "success");
            
            // Optional: Speak the response if a setting allows it (not implemented yet, but good practice)
            // if (autoSpeakSetting) { speak(finalReply); }
        }

      } catch (err) {
        console.error("Error in runVoiceCommand:", err);
        responseDiv.textContent = `Error: ${err.message}`;
        updateStatus("Error occurred", "error");
      } finally {
        showLoader(false);
        setTimeout(() => {
          // Only return to Idle if not currently speaking
          if (!window.speechSynthesis.speaking && (status.classList.contains("status-success") || status.classList.contains("status-error"))) {
            updateStatus("Idle", "idle");
          }
        }, 3000);
      }
    }

    // --- 5. Helper Functions ---

    // Helper function to send message with retry and injection logic
    async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        
        function attempt() {
          attempts++;
          chrome.tabs.sendMessage(tabId, message, response => {
            if (chrome.runtime.lastError) {
              if (attempts < maxRetries) {
                console.log(`Retry ${attempts}/${maxRetries} message to content script...`);
                // Inject content script if the error suggests it's not loaded
                if (chrome.runtime.lastError.message.includes("Could not establish connection")) {
                     chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content.js']
                     }).then(() => {
                        setTimeout(attempt, 300); // Retry after injection
                     }).catch(injectErr => {
                        reject(new Error(`Failed to inject and communicate: ${injectErr.message}`));
                     });
                } else {
                    setTimeout(attempt, 300);
                }
              } else {
                reject(new Error(`Max retries reached: ${chrome.runtime.lastError.message}`));
              }
            } else {
              resolve(response);
            }
          });
        }
        
        attempt();
      });
    }

    // Text-to-Speech (TTS) function
    function speak(text) {
      if (!text || !text.trim()) return;
      
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = "en-US";
      
      utterance.onstart = () => {
         updateStatus("Speaking...", "listening"); 
      };
      
      utterance.onend = () => {
        updateStatus("Complete!", "success");
        setTimeout(() => updateStatus("Idle", "idle"), 1500);
      };
      
      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        updateStatus("Speech error", "error");
      };
      
      window.speechSynthesis.speak(utterance);
    }

    // Status updater utility
    function updateStatus(message, type) {
      status.textContent = message;
      status.classList.remove("status-idle", "status-listening", "status-processing", "status-success", "status-error");
      status.classList.add(`status-${type}`);
    }

    // Loader utility
    function showLoader(show) {
      if (loader) {
        loader.classList.toggle("hidden", !show);
      }
    }

});