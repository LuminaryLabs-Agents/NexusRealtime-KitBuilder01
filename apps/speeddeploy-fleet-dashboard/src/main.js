import { createSpeedDeployEngine } from "./compose-speeddeploy.js";
import { renderDashboard } from "./render-dashboard.js";
import { attachDashboardActions } from "./dashboard-actions.js";

const root = document.querySelector("#app");
const errorPanel = document.querySelector("#errorPanel");

function showFatal(error) {
  errorPanel.hidden = false;
  errorPanel.textContent = String(error?.stack ?? error?.message ?? error);
}

try {
  const { engine, fixture } = createSpeedDeployEngine();
  function render() { renderDashboard(root, engine); }
  attachDashboardActions({ root, engine, render });
  render();
  window.SpeedDeployHost = { engine, fixture, render, getState: () => engine.dashboardView.getSnapshot() };
} catch (error) {
  showFatal(error);
}
