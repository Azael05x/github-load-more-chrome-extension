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
const MAX_RETRY_ATTEMPTS = 80;
const TOOLTIP_ID = "gh-pr-auto-load-more-tooltip";
const TOOLTIP_COLOR_PENDING = "#d97706";
const TOOLTIP_COLOR_COMPLETE = "#15803d";
const TOOLTIP_COLOR_ERROR = "#dc2626";
const ERROR_MESSAGE = "Github Extension Failed To Inject";
const OBSERVER_CONFIG = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["disabled", "aria-disabled"]
};

let activeContainer = null;
let retryTimer = null;
let retryAttempts = 0;
let observer = null;
let buttonObserver = null;
let lastTooltipMessage = null;
let lastTooltipColor = null;

function isPullRequestPage() {
  return /^\/[^/]+\/[^/]+\/pull\/\d+/.test(window.location.pathname);
}

function isButtonDisabled(button) {
  return button.disabled || button.getAttribute("aria-disabled") === "true";
}

function getLoadMoreButton(container = document) {
  return container.querySelector(LOAD_MORE_BUTTON_SELECTOR);
}

function getLoadAllButton(form) {
  return form?.querySelector(`[${LOAD_ALL_BUTTON_ATTRIBUTE}="true"]`);
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
  Object.assign(tooltip.style, {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: "9999",
    padding: "10px 14px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: "600",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
    transition: "opacity 120ms ease",
    pointerEvents: "none",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    opacity: "0",
    color: "#ffffff"
  });
  document.body.appendChild(tooltip);
  return tooltip;
}

function showTooltip(message, backgroundColor) {
  if (lastTooltipMessage === message && lastTooltipColor === backgroundColor) {
    return;
  }

  lastTooltipMessage = message;
  lastTooltipColor = backgroundColor;

  const tooltip = getTooltip();
  tooltip.textContent = message;
  tooltip.style.backgroundColor = backgroundColor;
  tooltip.style.opacity = "1";
}

function hideTooltip() {
  const tooltip = document.getElementById(TOOLTIP_ID);

  if (tooltip) {
    tooltip.style.opacity = "0";
  }

  lastTooltipMessage = null;
  lastTooltipColor = null;
}

function reportInjectionFailure(error) {
  console.error("[gh-pr-auto-load-more]", error);
  try {
    showTooltip(ERROR_MESSAGE, TOOLTIP_COLOR_ERROR);
  } catch (tooltipError) {
    console.error("[gh-pr-auto-load-more] tooltip render failed", tooltipError);
  }
}

function updateTooltip(container) {
  const remainingCount = getRemainingCount(container);

  if (remainingCount !== null) {
    showTooltip(`Loaded page, ${remainingCount} left`, TOOLTIP_COLOR_PENDING);
    return;
  }

  showTooltip("Loaded all GH comments", TOOLTIP_COLOR_COMPLETE);
}

function clearRetryTimer() {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function stopAutoload() {
  clearRetryTimer();
  retryAttempts = 0;

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

  const isDisabled = !loadMoreButton || isButtonDisabled(loadMoreButton);

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
    try {
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
    } catch (error) {
      reportInjectionFailure(error);
    }
  });
}

function ensureLoadAllButtons() {
  try {
    if (!isPullRequestPage()) {
      buttonObserver?.disconnect();
      buttonObserver = null;
      return;
    }

    syncLoadAllButtons();

    if (buttonObserver) {
      return;
    }

    buttonObserver = new MutationObserver(syncLoadAllButtons);
    buttonObserver.observe(document.documentElement, OBSERVER_CONFIG);
  } catch (error) {
    reportInjectionFailure(error);
  }
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

  if (isButtonDisabled(button)) {
    retryAttempts += 1;
    if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
      updateTooltip(activeContainer);
      stopAutoload();
      return;
    }
    queueNextAttempt();
    return;
  }

  retryAttempts = 0;
  button.click();
  queueNextAttempt();
}

function startAutoload(container) {
  if (!container || !isPullRequestPage()) {
    return;
  }

  activeContainer = container;
  retryAttempts = 0;
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

  observer.observe(activeContainer, OBSERVER_CONFIG);

  tryLoadMore();
}

document.addEventListener(
  "click",
  (event) => {
    try {
      if (!isPullRequestPage()) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const button = event.target.closest(
        `[${LOAD_ALL_BUTTON_ATTRIBUTE}="true"]`
      );

      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const form = button.closest(PAGINATION_FORM_SELECTOR);
      const container = form?.closest(TIMELINE_CONTAINER_SELECTOR);
      startAutoload(container);
    } catch (error) {
      reportInjectionFailure(error);
    }
  },
  true
);

document.addEventListener("turbo:load", () => {
  try {
    stopAutoload();
    hideTooltip();
    ensureLoadAllButtons();
  } catch (error) {
    reportInjectionFailure(error);
  }
});

try {
  ensureLoadAllButtons();
} catch (error) {
  reportInjectionFailure(error);
}
