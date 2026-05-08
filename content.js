const TIMELINE_CONTAINER_SELECTOR = "#js-progressive-timeline-item-container";
const PAGINATION_FORM_SELECTOR = "form.js-ajax-pagination";
const PAGINATION_BUTTON_SELECTOR =
  "button.ajax-pagination-btn[data-disable-with]";
const HIDDEN_ITEMS_BUTTON_SELECTOR =
  "button.color-fg-muted.ajax-pagination-btn";
const LOAD_MORE_BUTTON_SELECTOR =
  `${PAGINATION_FORM_SELECTOR} ${PAGINATION_BUTTON_SELECTOR}`;
const HIDDEN_ITEMS_SELECTOR =
  `${PAGINATION_FORM_SELECTOR} ${HIDDEN_ITEMS_BUTTON_SELECTOR}`;
const LOAD_ALL_BUTTON_ATTRIBUTE = "data-gh-pr-auto-load-all";
const RETRY_DELAY_MS = 250;
const TOOLTIP_ID = "gh-pr-auto-load-more-tooltip";

let activeContainer = null;
let retryTimer = null;
let observer = null;
let buttonObserver = null;

function isPullRequestPage() {
  return /^\/[^/]+\/[^/]+\/pull\/\d+/.test(window.location.pathname);
}

function getLoadMoreButton(container = document) {
  const button = container.querySelector(LOAD_MORE_BUTTON_SELECTOR);
  return button || null;
}

function getLoadAllButton(form) {
  return form?.querySelector(`[${LOAD_ALL_BUTTON_ATTRIBUTE}="true"]`) || null;
}

function getRemainingCount(container = document) {
  const summaryButton = container.querySelector(HIDDEN_ITEMS_SELECTOR);

  if (!summaryButton) {
    return null;
  }

  const match = summaryButton.textContent?.match(/([\d,]+)\s+hidden items/i);

  if (!match) {
    return null;
  }

  return Number.parseInt(match[1].replaceAll(",", ""), 10);
}

function getTooltip() {
  let tooltip = document.getElementById(TOOLTIP_ID);

  if (tooltip) {
    return tooltip;
  }

  tooltip = document.createElement("div");
  tooltip.id = TOOLTIP_ID;
  tooltip.style.position = "fixed";
  tooltip.style.top = "16px";
  tooltip.style.right = "16px";
  tooltip.style.zIndex = "9999";
  tooltip.style.padding = "10px 14px";
  tooltip.style.borderRadius = "999px";
  tooltip.style.fontSize = "13px";
  tooltip.style.fontWeight = "600";
  tooltip.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.18)";
  tooltip.style.transition = "opacity 120ms ease";
  tooltip.style.pointerEvents = "none";
  tooltip.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  tooltip.style.opacity = "0";
  document.body.appendChild(tooltip);
  return tooltip;
}

function showTooltip(message, backgroundColor) {
  const tooltip = getTooltip();
  tooltip.textContent = message;
  tooltip.style.backgroundColor = backgroundColor;
  tooltip.style.color = "#ffffff";
  tooltip.style.opacity = "1";
}

function hideTooltip() {
  const tooltip = document.getElementById(TOOLTIP_ID);

  if (tooltip) {
    tooltip.style.opacity = "0";
  }
}

function updateTooltip(container) {
  const remainingCount = getRemainingCount(container);

  if (remainingCount !== null) {
    showTooltip(`Loaded page, ${remainingCount} left`, "#d97706");
    return;
  }

  showTooltip("Loaded all GH comments", "#15803d");
}

function clearRetryTimer() {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function stopAutoload() {
  clearRetryTimer();

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  activeContainer = null;
}

function syncLoadAllButtonState(loadMoreButton, loadAllButton) {
  if (!loadAllButton) {
    return;
  }

  const isDisabled =
    !loadMoreButton ||
    loadMoreButton.disabled ||
    loadMoreButton.getAttribute("aria-disabled") === "true";

  if (loadAllButton.disabled !== isDisabled) {
    loadAllButton.disabled = isDisabled;
  }

  const nextAriaDisabled = isDisabled ? "true" : "false";

  if (loadAllButton.getAttribute("aria-disabled") !== nextAriaDisabled) {
    loadAllButton.setAttribute("aria-disabled", nextAriaDisabled);
  }
}

function createLoadAllButton(loadMoreButton) {
  const loadAllButton = document.createElement("button");
  loadAllButton.type = "button";
  loadAllButton.textContent = "Load All";
  loadAllButton.className = loadMoreButton.className;
  loadAllButton.setAttribute(LOAD_ALL_BUTTON_ATTRIBUTE, "true");
  loadAllButton.style.display = "block";
  loadAllButton.style.marginTop = "8px";
  loadAllButton.style.width = "100%";
  return loadAllButton;
}

function syncLoadAllButtons() {
  const forms = document.querySelectorAll(PAGINATION_FORM_SELECTOR);

  forms.forEach((form) => {
    const loadMoreButton = form.querySelector(PAGINATION_BUTTON_SELECTOR);
    const loadAllButton = getLoadAllButton(form);

    if (!loadMoreButton) {
      loadAllButton?.remove();
      return;
    }

    if (!loadAllButton) {
      const nextLoadAllButton = createLoadAllButton(loadMoreButton);
      loadMoreButton.insertAdjacentElement("afterend", nextLoadAllButton);
      syncLoadAllButtonState(loadMoreButton, nextLoadAllButton);
      return;
    }

    if (loadAllButton.previousElementSibling !== loadMoreButton) {
      loadMoreButton.insertAdjacentElement("afterend", loadAllButton);
    }

    syncLoadAllButtonState(loadMoreButton, loadAllButton);
  });
}

function ensureLoadAllButtons() {
  syncLoadAllButtons();

  if (buttonObserver) {
    return;
  }

  buttonObserver = new MutationObserver(() => {
    if (isPullRequestPage()) {
      syncLoadAllButtons();
    }
  });

  buttonObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "aria-disabled"]
  });
}

function queueNextAttempt() {
  clearRetryTimer();
  retryTimer = window.setTimeout(tryLoadMore, RETRY_DELAY_MS);
}

function tryLoadMore() {
  if (!activeContainer || !document.contains(activeContainer)) {
    stopAutoload();
    return;
  }

  const button = getLoadMoreButton(activeContainer);

  if (!button) {
    updateTooltip(activeContainer);
    stopAutoload();
    return;
  }

  if (button.disabled || button.getAttribute("aria-disabled") === "true") {
    queueNextAttempt();
    return;
  }

  button.click();
  queueNextAttempt();
}

function startAutoload(container) {
  if (!container || !isPullRequestPage()) {
    return;
  }

  activeContainer = container;
  updateTooltip(activeContainer);

  if (!observer) {
    observer = new MutationObserver(() => {
      if (activeContainer) {
        updateTooltip(activeContainer);
        queueNextAttempt();
      }
    });
  } else {
    observer.disconnect();
  }

  observer.observe(activeContainer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "aria-disabled"]
  });

  tryLoadMore();
}

document.addEventListener(
  "click",
  (event) => {
    if (!isPullRequestPage()) {
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest(`[${LOAD_ALL_BUTTON_ATTRIBUTE}="true"]`);

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const form = button.closest(PAGINATION_FORM_SELECTOR);
    const container = form?.closest(TIMELINE_CONTAINER_SELECTOR);
    startAutoload(container);
  },
  true
);

document.addEventListener("turbo:load", () => {
  stopAutoload();
  hideTooltip();
  ensureLoadAllButtons();
});

ensureLoadAllButtons();
