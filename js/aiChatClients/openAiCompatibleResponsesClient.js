function getResponseOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];

  return outputItems
    .flatMap(item => {
      const contentItems = Array.isArray(item?.content) ? item.content : [];

      if (item?.type === "message") {
        return contentItems
          .map(contentItem => {
            if (typeof contentItem?.text === "string") {
              return contentItem.text.trim();
            }

            if (typeof contentItem?.content === "string") {
              return contentItem.content.trim();
            }

            return "";
          })
          .filter(Boolean);
      }

      return [];
    })
    .join("\n\n");
}

function getReasoningOutputText(payload) {
  const outputItems = Array.isArray(payload?.output) ? payload.output : [];

  return outputItems
    .flatMap(item => {
      if (item?.type !== "reasoning") {
        return [];
      }

      const contentItems = Array.isArray(item.content) ? item.content : [];
      return contentItems
        .map(contentItem => {
          if (typeof contentItem?.text === "string") {
            return contentItem.text.trim();
          }

          if (typeof contentItem?.content === "string") {
            return contentItem.content.trim();
          }

          return "";
        })
        .filter(Boolean);
    })
    .join("\n\n");
}

function hasReasoningOnlyOutput(payload) {
  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  if (!outputItems.length) {
    return false;
  }

  const hasMessageOutput = outputItems.some(item => item?.type === "message");
  const hasReasoningOutput = outputItems.some(item => item?.type === "reasoning");
  return hasReasoningOutput && !hasMessageOutput;
}

function normalizeReasoningSetting(value, fallback = "medium") {
  const normalized = String(value || fallback).trim().toLowerCase() || fallback;
  if (["off", "none", "false", "0"].includes(normalized)) {
    return normalized === "off" ? "off" : "none";
  }

  if (["on", "true", "1"].includes(normalized)) {
    return "on";
  }

  if (["minimal", "low", "medium", "high", "xhigh"].includes(normalized)) {
    return normalized;
  }

  return fallback;
}

function getReasoningMode(setting) {
  const normalized = normalizeReasoningSetting(setting, "medium");
  return normalized === "off" || normalized === "none"
    ? "off"
    : "on";
}

function parseSupportedReasoningSettings(error = null) {
  const responseBody = error?.debug?.responseBody;
  const rawMessage = String(
    responseBody?.error?.message
    || responseBody?.message
    || error?.message
    || ""
  );

  const supportedSegment = rawMessage.match(/Supported settings:\s*([^.]*)/i)?.[1]
    || rawMessage.match(/Expected\s*([^,]+?)(?:,\s*received|\s*$)/i)?.[1]
    || "";

  const supportedValues = [...supportedSegment.matchAll(/'([A-Za-z0-9_]+)'/g)]
    .map(match => String(match[1] || "").trim().toLowerCase())
    .filter(value => ["on", "off", "none", "minimal", "low", "medium", "high", "xhigh"].includes(value));
  return [...new Set(supportedValues)];
}

function getCompatibleReasoningSetting(preferredSetting, supportedSettings = []) {
  const normalizedPreferred = normalizeReasoningSetting(preferredSetting, "medium");
  const supported = [...new Set((Array.isArray(supportedSettings) ? supportedSettings : [])
    .map(value => String(value || "").trim().toLowerCase())
    .filter(Boolean))];

  if (!supported.length) {
    return "";
  }

  if (supported.includes(normalizedPreferred)) {
    return normalizedPreferred;
  }

  if (getReasoningMode(normalizedPreferred) === "off") {
    return ["off", "none", "minimal", "low"]
      .find(value => supported.includes(value)) || "";
  }

  return ["on", "medium", "high", "low", "minimal", "xhigh"]
    .find(value => supported.includes(value)) || "";
}

function getDisabledReasoningSetting(setting) {
  const normalized = normalizeReasoningSetting(setting, "medium");
  return normalized === "on" || normalized === "off"
    ? "off"
    : "none";
}

function buildDebugSnapshot(url, options = {}, response = null, payload = null, error = null) {
  let requestBody = null;
  if (typeof options.body === "string") {
    try {
      requestBody = JSON.parse(options.body);
    } catch {
      requestBody = options.body;
    }
  }

  return {
    method: options.method || "GET",
    url,
    status: response?.status ?? null,
    statusText: response?.statusText ?? "",
    requestBody,
    responseBody: payload,
    error: error instanceof Error ? error.message : (error ? String(error) : "")
  };
}

async function fetchJson(url, options = {}, errorLabel = "AI server") {
  const response = await fetch(url, options);
  const payload = await response.json();
  const debug = buildDebugSnapshot(url, options, response, payload);

  if (!response.ok) {
    const error = new Error(`${errorLabel} returned ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`);
    error.debug = {
      ...debug,
      error: error.message
    };
    throw error;
  }

  return {
    payload,
    debug
  };
}

function buildMessagesFromRequest(request) {
  const messages = [];
  const systemPrompt = String(request?.instructions || "").trim();
  const userInput = String(request?.input || "").trim();

  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt
    });
  }

  const conversationHistory = Array.isArray(request?.conversationHistory) ? request.conversationHistory : [];
  if (conversationHistory.length > 0) {
    conversationHistory.forEach(msg => {
      const role = msg.role === "user" ? "user" : "assistant";
      const content = String(msg.content || "").trim();
      if (content) {
        messages.push({ role, content });
      }
    });
  }

  if (userInput) {
    messages.push({
      role: "user",
      content: userInput
    });
  }

  return messages;
}

function buildRequestBody({ model, request, reasoningEffort }) {
  const normalizedModel = String(model || "").trim();
  const normalizedPrompt = String(request?.input || "").trim();
  const normalizedSystemPrompt = String(request?.instructions || "").trim();
  const normalizedReasoningEffort = normalizeReasoningSetting(reasoningEffort || request?.reasoningEffort, "medium");
  const normalizedTemperature = Number.isFinite(Number(request?.temperature))
    ? Number(request.temperature)
    : 0.7;
  const normalizedMaxOutputTokens = Number.isFinite(Number(request?.maxOutputTokens))
    ? Number(request.maxOutputTokens)
    : 4096;

  if (!normalizedModel) {
    throw new Error("No model is selected.");
  }

  if (!normalizedPrompt) {
    throw new Error("No prompt was provided.");
  }

  const messages = buildMessagesFromRequest(request);
  const hasConversationHistory = Array.isArray(request?.conversationHistory) && request.conversationHistory.length > 0;
  const requestInput = hasConversationHistory ? messages : normalizedPrompt;

  const requestBody = {
    model: normalizedModel,
    input: requestInput,
    reasoning: {
      effort: normalizedReasoningEffort
    },
    temperature: normalizedTemperature,
    max_output_tokens: normalizedMaxOutputTokens,
    store: false
  };

  if (normalizedSystemPrompt) {
    requestBody.instructions = normalizedSystemPrompt;
  }

  return requestBody;
}

async function sendReasoningRequest(requestUrl, requestBody, errorLabel) {
  return fetchJson(requestUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  }, errorLabel);
}

export async function sendOpenAiCompatibleResponse({
  baseUrl,
  model,
  request,
  errorLabel = "AI server"
}) {
  const normalizedBaseUrl = String(baseUrl || "").trim().replace(/\/+$/, "");
  const initialReasoningEffort = normalizeReasoningSetting(request?.reasoningEffort, "medium");
  const requestUrl = `${normalizedBaseUrl}/v1/responses`;

  let activeReasoningEffort = initialReasoningEffort;
  let requestBody = buildRequestBody({
    model,
    request,
    reasoningEffort: activeReasoningEffort
  });

  let payload;
  let debug;
  let compatibilityRetry = null;

  try {
    ({ payload, debug } = await sendReasoningRequest(requestUrl, requestBody, errorLabel));
  } catch (error) {
    const supportedSettings = parseSupportedReasoningSettings(error);
    const fallbackReasoningEffort = getCompatibleReasoningSetting(activeReasoningEffort, supportedSettings);

    if (
      supportedSettings.length
      && fallbackReasoningEffort
      && fallbackReasoningEffort !== activeReasoningEffort
    ) {
      activeReasoningEffort = fallbackReasoningEffort;
      requestBody = buildRequestBody({
        model,
        request,
        reasoningEffort: activeReasoningEffort
      });
      ({ payload, debug } = await sendReasoningRequest(requestUrl, requestBody, errorLabel));
      compatibilityRetry = {
        reason: "invalid-reasoning-enum",
        initialReasoningEffort,
        fallbackReasoningEffort,
        supportedSettings,
        initialError: error?.debug?.responseBody || error?.message || null
      };
    } else {
      throw error;
    }
  }

  const initialText = getResponseOutputText(payload);

  if (initialText) {
    return {
      text: initialText,
      debug: compatibilityRetry
        ? {
          ...debug,
          retry: compatibilityRetry
        }
        : debug
    };
  }

  if (getReasoningMode(activeReasoningEffort) !== "off" && hasReasoningOnlyOutput(payload)) {
    const fallbackReasoningEffort = getDisabledReasoningSetting(activeReasoningEffort);
    const fallbackRequestBody = buildRequestBody({
      model,
      request,
      reasoningEffort: fallbackReasoningEffort
    });

    const { payload: fallbackPayload, debug: fallbackDebug } = await sendReasoningRequest(requestUrl, fallbackRequestBody, errorLabel);

    return {
      text: getResponseOutputText(fallbackPayload),
      debug: {
        ...fallbackDebug,
        retry: {
          ...(compatibilityRetry || {}),
          reason: "initial-response-contained-reasoning-only",
          initialReasoningEffort: activeReasoningEffort,
          fallbackReasoningEffort,
          initialResponseBody: payload,
          initialReasoningText: getReasoningOutputText(payload)
        }
      }
    };
  }

  return {
    text: initialText,
    debug: compatibilityRetry
      ? {
        ...debug,
        retry: compatibilityRetry
      }
      : debug
  };
}
