// Small helpers shared by every page.

// Draft counter: shows how many placeholders are left on this page; disappears at zero.
// Off for now; set to true to bring it back.
const SHOW_DRAFT_COUNTER = false;
const left = document.querySelectorAll(".ph, .ph-fig").length;
if (SHOW_DRAFT_COUNTER && left) {
  const note = document.createElement("p");
  note.className = "draft-note";
  note.setAttribute("role", "status");
  note.textContent = `Draft: ${left} placeholder${left === 1 ? "" : "s"} left on this page`;
  document.body.appendChild(note);
}

// Copy buttons: <button class="copy-btn" data-copy="text">
document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      const target = document.getElementById(btn.dataset.copyTarget || "");
      if (target) getSelection().selectAllChildren(target);
      btn.textContent = "Selected, press Ctrl+C";
    }
    setTimeout(() => { btn.textContent = "Copy"; }, 2000);
  });
});

document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

// Project pages always open at the top. Some embedded previews carry the previous page's
// scroll position over; stop correcting as soon as the visitor scrolls on their own.
if (document.body.dataset.page === "project" && !location.hash) {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  let userScrolled = false;
  const stop = () => { userScrolled = true; };
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((e) => addEventListener(e, stop, { once: true, passive: true }));
  const toTop = () => { if (!userScrolled) scrollTo(0, 0); };
  toTop();
  addEventListener("load", toTop);
  [100, 300, 700].forEach((ms) => setTimeout(toTop, ms));
}
