import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  tool: (config: any) => config,
}));

import { buildFileManagerTool } from "@/lib/tools/file-manager";

const mockVfs = {
  rename: vi.fn(),
  deleteFile: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildFileManagerTool", () => {
  test("returns an object with description and inputSchema", () => {
    const toolDef = buildFileManagerTool(mockVfs as any);
    expect(typeof toolDef.description).toBe("string");
    expect(toolDef.description.length).toBeGreaterThan(0);
    expect(toolDef.inputSchema).toBeDefined();
  });

  test("inputSchema accepts rename command", () => {
    const toolDef = buildFileManagerTool(mockVfs as any);
    const result = toolDef.inputSchema.safeParse({
      command: "rename",
      path: "/old.jsx",
      new_path: "/new.jsx",
    });
    expect(result.success).toBe(true);
  });

  test("inputSchema accepts delete command without new_path", () => {
    const toolDef = buildFileManagerTool(mockVfs as any);
    const result = toolDef.inputSchema.safeParse({ command: "delete", path: "/App.jsx" });
    expect(result.success).toBe(true);
  });

  test("inputSchema rejects unknown commands", () => {
    const toolDef = buildFileManagerTool(mockVfs as any);
    const result = toolDef.inputSchema.safeParse({ command: "copy", path: "/App.jsx" });
    expect(result.success).toBe(false);
  });

  test("inputSchema rejects missing path", () => {
    const toolDef = buildFileManagerTool(mockVfs as any);
    const result = toolDef.inputSchema.safeParse({ command: "delete" });
    expect(result.success).toBe(false);
  });

  describe("rename command", () => {
    test("renames file and returns success response", async () => {
      const toolDef = buildFileManagerTool(mockVfs as any);
      mockVfs.rename.mockReturnValue(true);

      const result = await toolDef.execute({
        command: "rename",
        path: "/old.jsx",
        new_path: "/new.jsx",
      });

      expect(mockVfs.rename).toHaveBeenCalledOnce();
      expect(mockVfs.rename).toHaveBeenCalledWith("/old.jsx", "/new.jsx");
      expect(result).toMatchObject({ success: true });
      expect((result as any).message).toContain("/old.jsx");
      expect((result as any).message).toContain("/new.jsx");
    });

    test("returns error when rename returns false", async () => {
      const toolDef = buildFileManagerTool(mockVfs as any);
      mockVfs.rename.mockReturnValue(false);

      const result = await toolDef.execute({
        command: "rename",
        path: "/missing.jsx",
        new_path: "/somewhere.jsx",
      });

      expect(result).toMatchObject({ success: false });
      expect((result as any).error).toContain("/missing.jsx");
    });

    test("returns error without calling VFS when new_path is missing", async () => {
      const toolDef = buildFileManagerTool(mockVfs as any);

      const result = await toolDef.execute({ command: "rename", path: "/App.jsx" });

      expect(result).toMatchObject({ success: false });
      expect((result as any).error).toMatch(/new_path/i);
      expect(mockVfs.rename).not.toHaveBeenCalled();
    });

    test("renames nested paths", async () => {
      const toolDef = buildFileManagerTool(mockVfs as any);
      mockVfs.rename.mockReturnValue(true);

      await toolDef.execute({
        command: "rename",
        path: "/src/components/Old.tsx",
        new_path: "/src/components/New.tsx",
      });

      expect(mockVfs.rename).toHaveBeenCalledWith(
        "/src/components/Old.tsx",
        "/src/components/New.tsx"
      );
    });

    test("can rename a directory (move)", async () => {
      const toolDef = buildFileManagerTool(mockVfs as any);
      mockVfs.rename.mockReturnValue(true);

      const result = await toolDef.execute({
        command: "rename",
        path: "/components",
        new_path: "/src/components",
      });

      expect(mockVfs.rename).toHaveBeenCalledWith("/components", "/src/components");
      expect(result).toMatchObject({ success: true });
    });
  });

  describe("delete command", () => {
    test("deletes file and returns success response", async () => {
      const toolDef = buildFileManagerTool(mockVfs as any);
      mockVfs.deleteFile.mockReturnValue(true);

      const result = await toolDef.execute({ command: "delete", path: "/App.jsx" });

      expect(mockVfs.deleteFile).toHaveBeenCalledOnce();
      expect(mockVfs.deleteFile).toHaveBeenCalledWith("/App.jsx");
      expect(result).toMatchObject({ success: true });
      expect((result as any).message).toContain("/App.jsx");
    });

    test("returns error when file does not exist", async () => {
      const toolDef = buildFileManagerTool(mockVfs as any);
      mockVfs.deleteFile.mockReturnValue(false);

      const result = await toolDef.execute({ command: "delete", path: "/nonexistent.jsx" });

      expect(result).toMatchObject({ success: false });
      expect((result as any).error).toContain("/nonexistent.jsx");
    });

    test("deletes nested file paths", async () => {
      const toolDef = buildFileManagerTool(mockVfs as any);
      mockVfs.deleteFile.mockReturnValue(true);

      await toolDef.execute({ command: "delete", path: "/src/components/Button.tsx" });

      expect(mockVfs.deleteFile).toHaveBeenCalledWith("/src/components/Button.tsx");
    });

    test("ignores new_path when deleting", async () => {
      const toolDef = buildFileManagerTool(mockVfs as any);
      mockVfs.deleteFile.mockReturnValue(true);

      const result = await toolDef.execute({
        command: "delete",
        path: "/App.jsx",
        new_path: "/should-be-ignored.jsx",
      });

      expect(mockVfs.deleteFile).toHaveBeenCalledWith("/App.jsx");
      expect(result).toMatchObject({ success: true });
    });
  });

  describe("VFS isolation", () => {
    test("two tool instances operate on separate VFS instances", async () => {
      const vfsA = { rename: vi.fn().mockReturnValue(true), deleteFile: vi.fn() };
      const vfsB = { rename: vi.fn().mockReturnValue(false), deleteFile: vi.fn() };

      const toolA = buildFileManagerTool(vfsA as any);
      const toolB = buildFileManagerTool(vfsB as any);

      const resultA = await toolA.execute({ command: "rename", path: "/f.jsx", new_path: "/g.jsx" });
      const resultB = await toolB.execute({ command: "rename", path: "/f.jsx", new_path: "/g.jsx" });

      expect((resultA as any).success).toBe(true);
      expect((resultB as any).success).toBe(false);
    });
  });
});
