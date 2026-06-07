export const openHelpCenterEvent = "occuboard:open-help-center";

export function openHelpCenter(section = "") {
  window.dispatchEvent(new window.CustomEvent(openHelpCenterEvent, { detail: { section } }));
}
