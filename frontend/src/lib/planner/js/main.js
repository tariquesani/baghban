// ─── Init ─────────────────────────────────────────────────────────────────────
initSidebar();
initCanvas();
renderLists();
updateCalibReadout();

// Resize canvas to fill its container whenever the window changes size
new ResizeObserver(() => {
  const area = canvas.parentElement;
  canvas.width  = area.clientWidth;
  canvas.height = area.clientHeight;
  if (pickOnly && canvas.width && canvas.height) fitView();
  draw();
}).observe(canvas.parentElement);
