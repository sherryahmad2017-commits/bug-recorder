// Phase 1: the side panel is fully self-sufficient (auth + project selection
// live in chrome.storage, read directly by the panel). This worker's job for
// now is just registering the side panel to open on the toolbar-icon click;
// capture orchestration, the upload queue, and the network-failure monitor
// (docs/ARCHITECTURE.md §8) are added here in Phase 2/3 alongside the
// permissions those features need.

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
  console.error('[ReproFlow] Failed to set side panel behavior', error);
});
