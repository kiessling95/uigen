// @vitest-environment node
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue({ provider: "anthropic", modelId: "claude-haiku-4-5" }),
}));

import { MockLanguageModel, getLanguageModel } from "@/lib/provider";
import { anthropic } from "@ai-sdk/anthropic";

// Helper: build a prompt array with N tool messages after the initial user message
function makePrompt(userText: string, toolMessageCount = 0) {
  const messages: any[] = [
    { role: "user", content: [{ type: "text", text: userText }] },
  ];
  for (let i = 0; i < toolMessageCount; i++) {
    messages.push({ role: "tool", content: [] });
  }
  return messages;
}

describe("MockLanguageModel", () => {
  let model: MockLanguageModel;

  beforeEach(() => {
    model = new MockLanguageModel("test-model");
    vi.spyOn(model as any, "delay").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor and metadata", () => {
    test("stores modelId from constructor", () => {
      expect(model.modelId).toBe("test-model");
    });

    test("specificationVersion is v2", () => {
      expect(model.specificationVersion).toBe("v2");
    });

    test("provider is 'mock'", () => {
      expect(model.provider).toBe("mock");
    });

    test("supportedUrls is an empty object", () => {
      expect(model.supportedUrls).toEqual({});
    });
  });

  describe("doGenerate — response shape", () => {
    test("returns content, finishReason, usage, warnings, request, response", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a counter") });

      expect(Array.isArray(result.content)).toBe(true);
      expect(typeof result.finishReason).toBe("string");
      expect(result.usage).toMatchObject({
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
      });
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.request).toBeDefined();
      expect(result.response).toMatchObject({
        id: "mock",
        timestamp: expect.any(Date),
        modelId: "test-model",
      });
    });
  });

  describe("doGenerate — tool message count 0 (initial request)", () => {
    test("finishReason is tool-calls", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a counter", 0) });
      expect(result.finishReason).toBe("tool-calls");
    });

    test("content contains a text part mentioning the static response", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create something", 0) });
      const textPart = result.content.find((p: any) => p.type === "text");
      expect(textPart).toBeDefined();
      expect(textPart!.text).toContain("static response");
    });

    test("content contains a tool-call for str_replace_editor creating App.jsx", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a counter", 0) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      expect(toolCall).toBeDefined();
      expect(toolCall!.toolName).toBe("str_replace_editor");
      const input = JSON.parse(toolCall!.input);
      expect(input.command).toBe("create");
      expect(input.path).toBe("/App.jsx");
    });
  });

  describe("doGenerate — tool message count 1 (component creation)", () => {
    test("finishReason is tool-calls", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a counter", 1) });
      expect(result.finishReason).toBe("tool-calls");
    });

    test("content contains a tool-call creating the component file", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a counter", 1) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      expect(toolCall).toBeDefined();
      const input = JSON.parse(toolCall!.input);
      expect(input.command).toBe("create");
      expect(input.path).toContain("Counter");
    });
  });

  describe("doGenerate — tool message count 2 (enhancement)", () => {
    test("finishReason is tool-calls", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a counter", 2) });
      expect(result.finishReason).toBe("tool-calls");
    });

    test("content contains a str_replace tool-call", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a counter", 2) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      expect(toolCall).toBeDefined();
      const input = JSON.parse(toolCall!.input);
      expect(input.command).toBe("str_replace");
    });
  });

  describe("doGenerate — tool message count 3+ (final summary)", () => {
    test("finishReason is stop", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a counter", 3) });
      expect(result.finishReason).toBe("stop");
    });

    test("content contains a text part with 'Done!'", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a counter", 3) });
      const textPart = result.content.find((p: any) => p.type === "text");
      expect(textPart).toBeDefined();
      expect(textPart!.text).toContain("Done!");
    });

    test("content does not contain any tool-call", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("any", 4) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      expect(toolCall).toBeUndefined();
    });
  });

  describe("component selection by user prompt", () => {
    test("'form' keyword in prompt generates ContactForm component", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("build a contact form", 1) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      const input = JSON.parse(toolCall!.input);
      expect(input.path).toContain("ContactForm");
    });

    test("'card' keyword in prompt generates Card component", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("create a product card", 1) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      const input = JSON.parse(toolCall!.input);
      expect(input.path).toContain("Card");
    });

    test("unrecognized prompt defaults to Counter component", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("build something cool", 1) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      const input = JSON.parse(toolCall!.input);
      expect(input.path).toContain("Counter");
    });

    test("case-insensitive 'FORM' keyword still selects ContactForm", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("I NEED A FORM HERE", 1) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      const input = JSON.parse(toolCall!.input);
      expect(input.path).toContain("ContactForm");
    });
  });

  describe("extractUserPrompt", () => {
    test("extracts text from last user message with array content", async () => {
      // Verify by observing component selection based on extracted prompt
      const prompt = [
        { role: "user", content: [{ type: "text", text: "create a card" }] },
        { role: "tool", content: [] },
      ];
      const result = await model.doGenerate({ prompt });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      const input = JSON.parse(toolCall!.input);
      expect(input.path).toContain("Card");
    });

    test("extracts text from last user message with string content", async () => {
      const prompt = [
        { role: "user", content: "build a card component" },
        { role: "tool", content: [] },
      ];
      const result = await model.doGenerate({ prompt });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      const input = JSON.parse(toolCall!.input);
      expect(input.path).toContain("Card");
    });

    test("ignores assistant messages when extracting prompt", async () => {
      const prompt = [
        { role: "user", content: [{ type: "text", text: "build a card" }] },
        { role: "assistant", content: [{ type: "text", text: "here is your form" }] },
        { role: "tool", content: [] },
      ];
      // The last USER message is "build a card", not the assistant's "form"
      const result = await model.doGenerate({ prompt });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      const input = JSON.parse(toolCall!.input);
      expect(input.path).toContain("Card");
    });
  });

  describe("App.jsx code generation (tool message count 0)", () => {
    test("App.jsx imports from the component file", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("make a counter", 0) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      const input = JSON.parse(toolCall!.input);
      expect(input.file_text).toContain("Counter");
      expect(input.file_text).toContain("@/components");
    });

    test("Card App.jsx includes title and description props", async () => {
      const result = await model.doGenerate({ prompt: makePrompt("make a card", 0) });
      const toolCall = result.content.find((p: any) => p.type === "tool-call");
      const input = JSON.parse(toolCall!.input);
      expect(input.file_text).toContain("Card");
      expect(input.file_text).toContain("title");
    });
  });

  describe("doStream", () => {
    test("returns an object with a stream property", async () => {
      const result = await model.doStream({ prompt: makePrompt("create a counter") });
      expect(result.stream).toBeInstanceOf(ReadableStream);
    });

    test("stream emits a stream-start chunk first", async () => {
      const result = await model.doStream({ prompt: makePrompt("hello") });
      const reader = result.stream.getReader();
      const { value } = await reader.read();
      reader.releaseLock();
      expect(value).toMatchObject({ type: "stream-start" });
    });

    test("stream produces text-delta chunks", async () => {
      const result = await model.doStream({ prompt: makePrompt("make something") });
      const reader = result.stream.getReader();
      const chunks: any[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const deltas = chunks.filter((c) => c.type === "text-delta");
      expect(deltas.length).toBeGreaterThan(0);
    });

    test("stream ends with a finish chunk", async () => {
      const result = await model.doStream({ prompt: makePrompt("create something") });
      const reader = result.stream.getReader();
      const chunks: any[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const finish = chunks.find((c) => c.type === "finish");
      expect(finish).toBeDefined();
      expect(finish.finishReason).toBeDefined();
    });

    test("returns warnings and request metadata", async () => {
      const result = await model.doStream({ prompt: makePrompt("test") });
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.request).toBeDefined();
    });
  });
});

describe("getLanguageModel", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
    vi.clearAllMocks();
  });

  test("returns MockLanguageModel when API key is absent", () => {
    delete process.env.ANTHROPIC_API_KEY;
    const model = getLanguageModel();
    expect(model).toBeInstanceOf(MockLanguageModel);
  });

  test("returns MockLanguageModel when API key is an empty string", () => {
    process.env.ANTHROPIC_API_KEY = "";
    const model = getLanguageModel();
    expect(model).toBeInstanceOf(MockLanguageModel);
  });

  test("returns MockLanguageModel when API key is only whitespace", () => {
    process.env.ANTHROPIC_API_KEY = "   ";
    const model = getLanguageModel();
    expect(model).toBeInstanceOf(MockLanguageModel);
  });

  test("calls anthropic() with the correct model ID when key is present", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    getLanguageModel();
    expect(anthropic).toHaveBeenCalledWith("claude-haiku-4-5");
  });

  test("returns the anthropic model object when key is present", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    const model = getLanguageModel();
    expect(model).not.toBeInstanceOf(MockLanguageModel);
  });
});
