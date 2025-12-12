# Installation Guide - InteractAI Voice Extension

## Quick Setup (5 minutes)

### 1. Load the Extension
1. Open Google Chrome
2. Go to `chrome://extensions/`
3. Toggle "Developer mode" ON (top right)
4. Click "Load unpacked"
5. Select the `interactai-voice` folder
6. Extension should appear in your toolbar

### 2. Get Groq API Key
1. Go to [Groq Console](https://console.groq.com/keys)
2. Sign in or create account
3. Click "Create API Key"
4. Copy the key (starts with `gsk_`)

### 3. Configure Extension
1. Click the InteractAI Voice icon in Chrome toolbar
2. Paste your API key in the input field
3. Click "Save Key"
4. Status should show "API key saved"

### 4. Test It Out
1. Open the included `test-page.html` in Chrome
2. Click the extension icon to open popup
3. Click "🎤 Start Listening" or try quick action buttons
4. Say: "Summarize this page" or "Find pricing section"
5. Watch the AI perform actions!

## Troubleshooting

**Microphone not working?**
- Allow microphone permission when prompted
- Check Chrome settings: Settings > Privacy > Site Settings > Microphone

**API errors?**
- Verify your Groq API key is correct
- Check you have credits in your Groq account
- Try refreshing the page and extension

**Extension not loading?**
- Make sure all files are in the same folder
- Check Chrome developer console for errors
- Try reloading the extension in chrome://extensions/

## Usage Tips

- Speak clearly and wait for the "Listening..." status
- Use natural language: "scroll to pricing" vs "find pricing section"
- Quick action buttons work without voice input
- The AI can click buttons, highlight text, and scroll to sections
- All responses are spoken back to you automatically

## File Structure
```
interactai-voice/
├── manifest.json          # Extension config
├── popup.html/css/js      # Main interface
├── content.js             # Page interaction
├── service_worker.js      # Background processing
├── helper.js              # Utilities
├── test-page.html         # Demo page
└── README.md              # Documentation
```

Ready to explore the web with your voice! 🎤✨