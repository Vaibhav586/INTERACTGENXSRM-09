# InteractAI Voice - Chrome Extension

A voice-controlled AI assistant that lets you explore any website through natural language commands.

## Features

- 🎤 **Voice Recognition**: Use Web Speech API to convert voice to text
- 🤖 **AI Integration**: Groq API integration for fast intelligent responses
- 🎯 **Smart Actions**: Execute actions like scrolling, highlighting, clicking
- 🔊 **Text-to-Speech**: AI responses are spoken back to you
- ⚡ **Quick Actions**: Pre-built buttons for common tasks

## Setup

1. **Load Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this folder

2. **Add API Key**:
   - Click the extension icon in Chrome toolbar
   - Enter your Groq API key in the popup
   - Click "Save Key"

3. **Start Using**:
   - Click the microphone button or use quick action buttons
   - Speak your command naturally
   - Watch the AI perform actions on the webpage

## Example Commands

- "Summarize this page"
- "Find the pricing section"
- "Scroll to the contact information"
- "Highlight important information"
- "Read this page aloud"
- "Click on the sign up button"

## How It Works

1. **Voice Input**: Web Speech API captures your voice
2. **DOM Snapshot**: Extension extracts page structure (headings, paragraphs, links)
3. **AI Processing**: Groq API analyzes your command + page content
4. **Action Execution**: AI returns structured JSON for actions or replies
5. **Response**: Actions are executed or text is spoken back

## Files Structure

- `manifest.json` - Extension configuration
- `popup.html/css/js` - Main UI interface
- `content.js` - Webpage interaction script
- `service_worker.js` - Background processing & Groq API
- `helper.js` - Shared utility functions

## Supported Actions

- `scrollTo` - Scroll to specific elements
- `highlight` - Highlight elements with yellow border
- `click` - Click on buttons/links
- `reply` - Speak text responses

## Requirements

- Chrome browser with Web Speech API support
- Groq API key
- Microphone access permission