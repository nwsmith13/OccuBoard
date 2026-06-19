export const openHelpCenterEvent = "occuboard:open-help-center";
export const openFeedbackEvent = "occuboard:open-feedback";

export function openHelpCenter(section = "") {
  window.dispatchEvent(new window.CustomEvent(openHelpCenterEvent, { detail: { section } }));
}

export function openFeedback(type = "Feedback") {
  window.dispatchEvent(new window.CustomEvent(openFeedbackEvent, { detail: { type } }));
}
