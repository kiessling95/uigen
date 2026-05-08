"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
  useRef,
} from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { UIMessage, DefaultChatTransport } from "ai";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";

interface ChatContextProps {
  projectId?: string;
  initialMessages?: UIMessage[];
}

interface ChatContextType {
  messages: UIMessage[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: ChatContextProps & { children: ReactNode }) {
  const { fileSystem, handleToolCall } = useFileSystem();
  const [input, setInput] = useState("");
  const fileSystemRef = useRef(fileSystem);
  fileSystemRef.current = fileSystem;

  const {
    messages,
    sendMessage,
    status,
  } = useAIChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: initialMessages,
  });

  // Apply completed server-side tool calls to the client file system
  const appliedToolCallIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const parts = (message as any).parts ?? [];
      for (const part of parts) {
        const { toolCallId, toolName, state } = part;
        if (!toolCallId || !toolName) continue;
        if (appliedToolCallIds.current.has(toolCallId)) continue;
        // Accept any completed state (v6: output-available, legacy: result)
        if (state !== "output-available" && state !== "result") continue;

        appliedToolCallIds.current.add(toolCallId);
        const rawArgs = part.input ?? part.args;
        const args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
        handleToolCall({ toolName, args });
      }
    }
  }, [messages, handleToolCall]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput("");
    sendMessage(
      { text: value },
      { body: { files: fileSystemRef.current.serialize(), projectId } }
    );
  };

  // Track anonymous work
  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages, fileSystem.serialize());
    }
  }, [messages, fileSystem, projectId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        handleInputChange,
        handleSubmit,
        status,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
