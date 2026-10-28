// Feature tour on the Suspension App page: tab buttons, arrows and a counter
// that follow the sideways-scrolling cards.
(() => {
  const tour = document.querySelector("[data-tour]");
  if (!tour) return;
  const track = tour.querySelector(".tour-track");
  const cards = Array.from(track.querySelectorAll(".tour-card"));
  const chips = Array.from(tour.querySelectorAll(".tab-strip button"));
  const strip = tour.querySelector(".tab-strip");
  const prev = tour.querySelector("[data-tour-prev]");
  const next = tour.querySelector("[data-tour-next]");
  const count = tour.querySelector("[data-tour-count]");
  let current = 0;

  const go = (i) => {
    i = Math.max(0, Math.min(cards.length - 1, i));
    track.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft });
  };
  const mark = (i) => {
    current = i;
    chips.forEach((c, n) => c.setAttribute("aria-current", n === i ? "true" : "false"));
    prev.disabled = i === 0;
    next.disabled = i === cards.length - 1;
    count.textContent = (i + 1) + " / " + cards.length;
    const chip = chips[i];
    const left = chip.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + chip.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: left - 8 });
    }
  };

  chips.forEach((c, n) => c.addEventListener("click", () => go(n)));
  prev.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));

  let raf = 0;
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const x = track.scrollLeft;
      let best = 0, bestD = Infinity;
      cards.forEach((card, n) => {
        const d = Math.abs(card.offsetLeft - cards[0].offsetLeft - x);
        if (d < bestD) { bestD = d; best = n; }
      });
      if (best !== current) mark(best);
    });
  }, { passive: true });

  // open a card directly from a link such as suspension-dynamics.html#tab-rocker
  const fromHash = cards.findIndex((c) => "#" + c.id === location.hash);
  mark(0);
  if (fromHash > 0) { go(fromHash); mark(fromHash); }
})();

// Cards with several screenshots (Tyre, Forces): small buttons switch the view.
document.querySelectorAll(".tour-media").forEach((media) => {
  const views = Array.from(media.querySelectorAll(".tour-shot > [data-view]"));
  const buttons = Array.from(media.querySelectorAll(".view-switch button"));
  buttons.forEach((button, i) => button.addEventListener("click", () => {
    views.forEach((v, n) => { v.hidden = n !== i; });
    buttons.forEach((b, n) => b.setAttribute("aria-pressed", n === i ? "true" : "false"));
  }));
});
