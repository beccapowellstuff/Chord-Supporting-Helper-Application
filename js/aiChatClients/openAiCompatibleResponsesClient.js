function getResponseOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];

  return outputItems
    .flatMap(item => {
      if (item?.type !== "message") {
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

export async function sendOpenAiCompatibleResponse({
  baseUrl,
  model,
  prompt,
  systemPrompt = "",
  reasoningEffort = "medium",
  temperature = 0.7,
  maxOutputTokens = 4096,
  errorLabel = "AI server"
}) {
  const normalizedBaseUrl = String(baseUrl || "").trim().replace(/\/+$/, "");
  const normalizedModel = String(model || "").trim();
  const normalizedPrompt = String(prompt || "").trim();
  const normalizedSystemPrompt = String(systemPrompt || "").trim();
  const normalizedReasoningEffort = String(reasoningEffort || "").trim().toLowerCase() || "medium";

  if (!normalizedModel) {
    throw new Error("No model is selected.");
  }

  if (!normalizedPrompt) {
    throw new Error("No prompt was provided.");
  }

  const requestBody = {
    model: normalizedModel,
    input: normalizedPrompt,
    reasoning: {
      effort: normalizedReasoningEffort
    },
    temperature,
    max_output_tokens: maxOutputTokens,
    store: false
  };

  if (normalizedSystemPrompt) {
    requestBody.instructions = normalizedSystemPrompt;
  }

  const { payload, debug } = await fetchJson(`${normalizedBaseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  }, errorLabel);

  return {
    text: getResponseOutputText(payload),
    debug
  };
}
