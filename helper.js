// helper.js
const MAX_DOM_CHARS = 14000;

// Extract a compact structured DOM snapshot
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
    // Trim paragraphs if too long
    page.paragraphs = page.paragraphs.slice(0, 10);
    json = JSON.stringify(page);
  }
  return page;
}

// simple function to highlight selector & flash
function highlightElement(el) {
  if (!el) return;
  const original = el.style.boxShadow;
  el.style.boxShadow = "0 0 0 4px rgba(255,255,0,0.6)";
  el.scrollIntoView({behavior: "smooth", block: "center"});
  setTimeout(()=> { el.style.boxShadow = original; }, 3000);
}
