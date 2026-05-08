import { describe, test, expect, beforeEach } from "vitest";
import {
  setHasAnonWork,
  getHasAnonWork,
  getAnonWorkData,
  clearAnonWork,
} from "@/lib/anon-work-tracker";

const STORAGE_KEY = "uigen_has_anon_work";
const DATA_KEY = "uigen_anon_data";

beforeEach(() => {
  sessionStorage.clear();
});

describe("setHasAnonWork", () => {
  test("stores data when messages array is non-empty", () => {
    const messages = [{ role: "user", content: "hello" }];
    setHasAnonWork(messages, { "/": { type: "directory" } });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(sessionStorage.getItem(DATA_KEY)).not.toBeNull();
  });

  test("stores data when fileSystemData has more than just root", () => {
    setHasAnonWork([], {
      "/": { type: "directory" },
      "/App.jsx": { type: "file", content: "..." },
    });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  test("does NOT store data when messages are empty and fileSystemData has only root", () => {
    setHasAnonWork([], { "/": { type: "directory" } });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(DATA_KEY)).toBeNull();
  });

  test("does NOT store data when both messages and fileSystemData are empty", () => {
    setHasAnonWork([], {});

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("serializes messages and fileSystemData as JSON", () => {
    const messages = [{ id: "1", role: "user", content: "build a card" }];
    const fs = { "/": {}, "/App.jsx": { content: "code" } };

    setHasAnonWork(messages, fs);

    const raw = sessionStorage.getItem(DATA_KEY)!;
    const parsed = JSON.parse(raw);
    expect(parsed.messages).toEqual(messages);
    expect(parsed.fileSystemData).toEqual(fs);
  });

  test("overwrites previously stored data on repeated calls", () => {
    setHasAnonWork([{ role: "user", content: "first" }], { "/": {} });
    setHasAnonWork([{ role: "user", content: "second" }], { "/": {}, "/App.jsx": {} });

    const parsed = JSON.parse(sessionStorage.getItem(DATA_KEY)!);
    expect(parsed.messages[0].content).toBe("second");
  });
});

describe("getHasAnonWork", () => {
  test("returns false when nothing is stored", () => {
    expect(getHasAnonWork()).toBe(false);
  });

  test("returns false when storage key is not 'true'", () => {
    sessionStorage.setItem(STORAGE_KEY, "false");
    expect(getHasAnonWork()).toBe(false);
  });

  test("returns true after setHasAnonWork stores data", () => {
    setHasAnonWork([{ role: "user", content: "hello" }], {});
    expect(getHasAnonWork()).toBe(true);
  });

  test("returns true when STORAGE_KEY is exactly 'true'", () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    expect(getHasAnonWork()).toBe(true);
  });
});

describe("getAnonWorkData", () => {
  test("returns null when nothing is stored", () => {
    expect(getAnonWorkData()).toBeNull();
  });

  test("returns null when DATA_KEY holds invalid JSON", () => {
    sessionStorage.setItem(DATA_KEY, "not-json{{{{");
    expect(getAnonWorkData()).toBeNull();
  });

  test("returns parsed messages and fileSystemData", () => {
    const messages = [{ id: "m1", role: "user", content: "create a form" }];
    const fileSystemData = { "/App.jsx": { content: "code" } };

    sessionStorage.setItem(DATA_KEY, JSON.stringify({ messages, fileSystemData }));

    const result = getAnonWorkData();
    expect(result).not.toBeNull();
    expect(result!.messages).toEqual(messages);
    expect(result!.fileSystemData).toEqual(fileSystemData);
  });

  test("returns data consistent with what setHasAnonWork stored", () => {
    const messages = [{ role: "assistant", content: "Here is your component" }];
    const fileSystemData = { "/": {}, "/App.jsx": { content: "..." } };

    setHasAnonWork(messages, fileSystemData);

    const result = getAnonWorkData();
    expect(result!.messages).toEqual(messages);
    expect(result!.fileSystemData).toEqual(fileSystemData);
  });

  test("returns null for empty string stored in DATA_KEY", () => {
    sessionStorage.setItem(DATA_KEY, "");
    expect(getAnonWorkData()).toBeNull();
  });
});

describe("clearAnonWork", () => {
  test("removes STORAGE_KEY from sessionStorage", () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    clearAnonWork();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("removes DATA_KEY from sessionStorage", () => {
    sessionStorage.setItem(DATA_KEY, JSON.stringify({ messages: [], fileSystemData: {} }));
    clearAnonWork();
    expect(sessionStorage.getItem(DATA_KEY)).toBeNull();
  });

  test("clears both keys set by setHasAnonWork", () => {
    setHasAnonWork([{ role: "user", content: "build something" }], {});
    clearAnonWork();

    expect(getHasAnonWork()).toBe(false);
    expect(getAnonWorkData()).toBeNull();
  });

  test("is safe to call when nothing is stored", () => {
    expect(() => clearAnonWork()).not.toThrow();
    expect(getHasAnonWork()).toBe(false);
  });

  test("getHasAnonWork returns false after clearing", () => {
    setHasAnonWork([{ role: "user", content: "hello" }], {});
    expect(getHasAnonWork()).toBe(true);

    clearAnonWork();
    expect(getHasAnonWork()).toBe(false);
  });
});
