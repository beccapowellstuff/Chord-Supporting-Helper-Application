function getMessageTextContent(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === "string") {
          return part.trim();
        }

        if (part?.type === "text") {
          return String(part.text || "").trim();
        }

        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

function getAssistantMessageText(payload) {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  const firstChoice = choices[0];
  const content = firstChoice?.message?.content;
  return getMessageTextContent(content);
}

async function fetchJson(url, options = {}, errorLabel = "AI server") {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`${errorLabel} returned ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`);
  }

  return response.json();
}

export async function sendOpenAiCompatibleChatCompletion({
  baseUrl,
  model,
  prompt,
  systemPrompt = "",
  temperature = 0.7,
  maxTokens = 4096,
  errorLabel = "AI server"
}) {
  const normalizedBaseUrl = String(baseUrl || "").trim().replace(/\/+$/, "");
  const normalizedModel = String(model || "").trim();
  const normalizedPrompt = String(prompt || "").trim();
  const normalizedSystemPrompt = String(systemPrompt || "").trim();

  if (!normalizedModel) {
    throw new Error("No model is selected.");
  }

  if (!normalizedPrompt) {
    throw new Error("No prompt was provided.");
  }

  const messages = [];
  if (normalizedSystemPrompt) {
    messages.push({
      role: "system",
      content: normalizedSystemPrompt
    });
  }

  messages.push({
    role: "user",
    content: normalizedPrompt
  });

  const payload = await fetchJson(`${normalizedBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: normalizedModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    })
  }, errorLabel);

  return {
    text: getAssistantMessageText(payload)
  };
}
