// content.js
// Note: include a copy of helper functions here (or import via bundler). For simplicity, paste extractPageSnapshot + highlightElement.
const MAX_DOM_CHARS = 14000;
function extractPageSnapshot() {
  const headings = [...document.querySelectorAll("h1,h2,h3")].map(h => ({tag: h.tagName, text: h.innerText.trim()}));
  const paragraphs = [...document.querySelectorAll("p")].slice(0, 40).map(p => p.innerText.trim());
  const links = [...document.querySelectorAll("a[href]")].slice(0, 60).map(a => ({text:a.innerText.trim(), href: a.href}));
  const page = {
    url: location.href,
    title: document.title,
    headings,
    paragraphs,
    links
  };
  let json = JSON.stringify(page);
  if (json.length > MAX_DOM_CHARS) {
    page.paragraphs = page.paragraphs.slice(0, 10);
  }
  return page;
}

function highlightElement(el) {
  if (!el) return;
  const original = el.style.boxShadow;
  el.style.boxShadow = "0 0 0 4px rgba(255,255,0,0.6)";
  el.scrollIntoView({behavior: "smooth", block: "center"});
  setTimeout(()=> { el.style.boxShadow = original; }, 3000);
}

// Receive messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SNAPSHOT") {
    const snap = extractPageSnapshot();
    sendResponse({snapshot: snap});
    return true;
  }

  if (msg.type === "EXECUTE_ACTION") {
    // msg.action expected to be parsed JSON: {action: "scrollTo"|"highlight"|"click"|"reply", selector: "...", text: "..."}
    const a = msg.action;
    if (a.action === "scrollTo" && a.selector) {
      let el = null;
      try { el = document.querySelector(a.selector); } catch(e) {}
      if (!el) {
        // try text based search for headings
        const nodes = [...document.querySelectorAll("h1,h2,h3,h4,p")].filter(n => n.innerText && n.innerText.toLowerCase().includes((a.text || "").toLowerCase()));
        el = nodes[0];
      }
      if (el) {
        highlightElement(el);
        sendResponse({ok:true});
      } else sendResponse({ok:false, reason:"not found"});
      return true;
    }

    if (a.action === "highlight" && a.selector) {
      let el = null;
      try { el = document.querySelector(a.selector); } catch(e) {}
      if (!el && a.text) {
        // fallback: search by text content
        const nodes = [...document.querySelectorAll("*")].filter(n => n.innerText && n.innerText.toLowerCase().includes(a.text.toLowerCase()));
        el = nodes[0];
      }
      if (el) {
        highlightElement(el);
        sendResponse({ok: true});
      } else {
        sendResponse({ok: false, reason: "Element not found"});
      }
      return true;
    }

    if (a.action === "click" && a.selector) {
      let el = null;
      try { el = document.querySelector(a.selector); } catch(e) {}
      if (!el && a.text) {
        // fallback: search clickable elements by text
        const clickable = [...document.querySelectorAll("a, button, [onclick], [role='button']")].filter(n => n.innerText && n.innerText.toLowerCase().includes(a.text.toLowerCase()));
        el = clickable[0];
      }
      if (el) {
        el.click();
        sendResponse({ok: true});
      } else {
        sendResponse({ok: false, reason: "Clickable element not found"});
      }
      return true;
    }

    if (a.action === "reply" && a.text) {
      // speak reply using page's SpeechSynthesis
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(a.text);
        window.speechSynthesis.speak(u);
        sendResponse({ok:true});
      } catch(e) { sendResponse({ok:false, err:e.toString()}); }
      return true;
    }
  }
});
