import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock the AI SDK so the returned tool object is just the raw config
vi.mock("ai", () => ({
  tool: (config: any) => config,
}));

import { buildStrReplaceTool } from "@/lib/tools/str-replace";

const mockVfs = {
  viewFile: vi.fn(),
  createFileWithParents: vi.fn(),
  replaceInFile: vi.fn(),
  insertInFile: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildStrReplaceTool", () => {
  test("returns an object with description and inputSchema", () => {
    const toolDef = buildStrReplaceTool(mockVfs as any);
    expect(typeof toolDef.description).toBe("string");
    expect(toolDef.description.length).toBeGreaterThan(0);
    expect(toolDef.inputSchema).toBeDefined();
  });

  test("inputSchema accepts all expected commands", () => {
    const toolDef = buildStrReplaceTool(mockVfs as any);
    const valid = toolDef.inputSchema.safeParse({ command: "view", path: "/App.jsx" });
    expect(valid.success).toBe(true);
  });

  test("inputSchema rejects unknown commands", () => {
    const toolDef = buildStrReplaceTool(mockVfs as any);
    const result = toolDef.inputSchema.safeParse({ command: "unknown", path: "/App.jsx" });
    expect(result.success).toBe(false);
  });

  describe("view command", () => {
    test("calls viewFile with path and view_range", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.viewFile.mockReturnValue("line 1\nline 2\n");

      const result = await toolDef.execute({
        command: "view",
        path: "/App.jsx",
        view_range: [1, 10],
      });

      expect(mockVfs.viewFile).toHaveBeenCalledOnce();
      expect(mockVfs.viewFile).toHaveBeenCalledWith("/App.jsx", [1, 10]);
      expect(result).toBe("line 1\nline 2\n");
    });

    test("passes undefined view_range when not provided", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.viewFile.mockReturnValue("content");

      await toolDef.execute({ command: "view", path: "/App.jsx" });

      expect(mockVfs.viewFile).toHaveBeenCalledWith("/App.jsx", undefined);
    });

    test("returns whatever viewFile returns", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.viewFile.mockReturnValue("Error: file not found");

      const result = await toolDef.execute({ command: "view", path: "/missing.jsx" });

      expect(result).toBe("Error: file not found");
    });
  });

  describe("create command", () => {
    test("calls createFileWithParents with path and file_text", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      const fakeNode = { type: "file", path: "/App.jsx" };
      mockVfs.createFileWithParents.mockReturnValue(fakeNode);

      const result = await toolDef.execute({
        command: "create",
        path: "/App.jsx",
        file_text: "export default function App() {}",
      });

      expect(mockVfs.createFileWithParents).toHaveBeenCalledOnce();
      expect(mockVfs.createFileWithParents).toHaveBeenCalledWith(
        "/App.jsx",
        "export default function App() {}"
      );
      expect(result).toBe(fakeNode);
    });

    test("defaults file_text to empty string when omitted", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.createFileWithParents.mockReturnValue(null);

      await toolDef.execute({ command: "create", path: "/empty.jsx" });

      expect(mockVfs.createFileWithParents).toHaveBeenCalledWith("/empty.jsx", "");
    });

    test("creates nested paths", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.createFileWithParents.mockReturnValue({ type: "file" });

      await toolDef.execute({
        command: "create",
        path: "/src/components/Button.tsx",
        file_text: "export const Button = () => <button />;",
      });

      expect(mockVfs.createFileWithParents).toHaveBeenCalledWith(
        "/src/components/Button.tsx",
        "export const Button = () => <button />;"
      );
    });
  });

  describe("str_replace command", () => {
    test("calls replaceInFile with path, old_str, and new_str", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.replaceInFile.mockReturnValue("replacement success");

      const result = await toolDef.execute({
        command: "str_replace",
        path: "/App.jsx",
        old_str: "const x = 1;",
        new_str: "const x = 2;",
      });

      expect(mockVfs.replaceInFile).toHaveBeenCalledOnce();
      expect(mockVfs.replaceInFile).toHaveBeenCalledWith(
        "/App.jsx",
        "const x = 1;",
        "const x = 2;"
      );
      expect(result).toBe("replacement success");
    });

    test("defaults old_str and new_str to empty strings when omitted", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.replaceInFile.mockReturnValue("ok");

      await toolDef.execute({ command: "str_replace", path: "/App.jsx" });

      expect(mockVfs.replaceInFile).toHaveBeenCalledWith("/App.jsx", "", "");
    });

    test("handles multiline replacements", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.replaceInFile.mockReturnValue("ok");

      await toolDef.execute({
        command: "str_replace",
        path: "/App.jsx",
        old_str: "line1\nline2\nline3",
        new_str: "replaced",
      });

      expect(mockVfs.replaceInFile).toHaveBeenCalledWith(
        "/App.jsx",
        "line1\nline2\nline3",
        "replaced"
      );
    });
  });

  describe("insert command", () => {
    test("calls insertInFile with path, insert_line, and new_str", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.insertInFile.mockReturnValue("insert success");

      const result = await toolDef.execute({
        command: "insert",
        path: "/App.jsx",
        insert_line: 5,
        new_str: "import React from 'react';",
      });

      expect(mockVfs.insertInFile).toHaveBeenCalledOnce();
      expect(mockVfs.insertInFile).toHaveBeenCalledWith(
        "/App.jsx",
        5,
        "import React from 'react';"
      );
      expect(result).toBe("insert success");
    });

    test("defaults insert_line to 0 when omitted", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.insertInFile.mockReturnValue("ok");

      await toolDef.execute({ command: "insert", path: "/App.jsx", new_str: "// comment" });

      expect(mockVfs.insertInFile).toHaveBeenCalledWith("/App.jsx", 0, "// comment");
    });

    test("defaults new_str to empty string when omitted", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.insertInFile.mockReturnValue("ok");

      await toolDef.execute({ command: "insert", path: "/App.jsx", insert_line: 3 });

      expect(mockVfs.insertInFile).toHaveBeenCalledWith("/App.jsx", 3, "");
    });

    test("inserts at line 0 (before first line)", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      mockVfs.insertInFile.mockReturnValue("ok");

      await toolDef.execute({
        command: "insert",
        path: "/App.jsx",
        insert_line: 0,
        new_str: "// header",
      });

      expect(mockVfs.insertInFile).toHaveBeenCalledWith("/App.jsx", 0, "// header");
    });
  });

  describe("undo_edit command", () => {
    test("returns an error string without calling any VFS method", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);

      const result = await toolDef.execute({ command: "undo_edit", path: "/App.jsx" });

      expect(typeof result).toBe("string");
      expect(result).toContain("undo_edit");
      expect(result).toContain("str_replace");
      expect(mockVfs.viewFile).not.toHaveBeenCalled();
      expect(mockVfs.createFileWithParents).not.toHaveBeenCalled();
      expect(mockVfs.replaceInFile).not.toHaveBeenCalled();
      expect(mockVfs.insertInFile).not.toHaveBeenCalled();
    });

    test("error message indicates the command is not supported", async () => {
      const toolDef = buildStrReplaceTool(mockVfs as any);
      const result = await toolDef.execute({ command: "undo_edit", path: "/any.jsx" }) as string;
      expect(result.toLowerCase()).toContain("not supported");
    });
  });

  describe("VFS isolation", () => {
    test("each call to buildStrReplaceTool uses its own VFS instance", async () => {
      const vfsA = { viewFile: vi.fn().mockReturnValue("from A") };
      const vfsB = { viewFile: vi.fn().mockReturnValue("from B") };

      const toolA = buildStrReplaceTool(vfsA as any);
      const toolB = buildStrReplaceTool(vfsB as any);

      const resultA = await toolA.execute({ command: "view", path: "/f.jsx" });
      const resultB = await toolB.execute({ command: "view", path: "/f.jsx" });

      expect(resultA).toBe("from A");
      expect(resultB).toBe("from B");
      expect(vfsA.viewFile).toHaveBeenCalledOnce();
      expect(vfsB.viewFile).toHaveBeenCalledOnce();
    });
  });
});
