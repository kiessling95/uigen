import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: any[]) => mockSignInAction(...args),
  signUp: (...args: any[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: (...args: any[]) => mockGetAnonWorkData(...args),
  clearAnonWork: (...args: any[]) => mockClearAnonWork(...args),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: (...args: any[]) => mockGetProjects(...args),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: any[]) => mockCreateProject(...args),
}));

import { useAuth } from "@/hooks/use-auth";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no anon work, no existing projects
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" });
  mockSignInAction.mockResolvedValue({ success: true });
  mockSignUpAction.mockResolvedValue({ success: true });
});

describe("useAuth", () => {
  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  test("isLoading is false initially", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });
});

describe("signIn", () => {
  test("calls signInAction with email and password", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });
    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "password123");
  });

  test("returns the result from signInAction", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("bad@example.com", "wrong");
    });
    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("sets isLoading to false after success", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });
    expect(result.current.isLoading).toBe(false);
  });

  test("sets isLoading to false after failure", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid" });
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "wrong");
    });
    expect(result.current.isLoading).toBe(false);
  });

  test("does not navigate when sign-in fails", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid" });
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "wrong");
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  describe("post sign-in navigation — anon work exists", () => {
    test("creates a project with the anon messages and file system", async () => {
      const messages = [{ role: "user", content: "build a counter" }];
      const fileSystemData = { "/App.jsx": { content: "code" } };
      mockGetAnonWorkData.mockReturnValue({ messages, fileSystemData });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages, data: fileSystemData })
      );
    });

    test("navigates to the newly created project", async () => {
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "test" }],
        fileSystemData: {},
      });
      mockCreateProject.mockResolvedValue({ id: "anon-project-42" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/anon-project-42");
    });

    test("clears anon work after creating the project", async () => {
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "test" }],
        fileSystemData: {},
      });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockClearAnonWork).toHaveBeenCalledOnce();
    });

    test("does not call getProjects when anon work exists", async () => {
      mockGetAnonWorkData.mockReturnValue({
        messages: [{ role: "user", content: "test" }],
        fileSystemData: {},
      });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockGetProjects).not.toHaveBeenCalled();
    });
  });

  describe("post sign-in navigation — no anon work, existing projects", () => {
    test("navigates to the most recent project", async () => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([
        { id: "proj-recent" },
        { id: "proj-older" },
      ]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-recent");
    });

    test("does not create a new project when existing projects exist", async () => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "proj-1" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockCreateProject).not.toHaveBeenCalled();
    });
  });

  describe("post sign-in navigation — no anon work, no projects", () => {
    test("creates a new empty project", async () => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "brand-new" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
    });

    test("navigates to the newly created project", async () => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "fresh-project" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/fresh-project");
    });

    test("does not clear anon work when there is none", async () => {
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
    });
  });

  describe("anon work with empty messages array", () => {
    test("treats anon work with 0 messages as 'no anon work' and falls through to getProjects", async () => {
      mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
      mockGetProjects.mockResolvedValue([{ id: "existing-proj" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-proj");
    });
  });
});

describe("signUp", () => {
  test("calls signUpAction with email and password", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "securepass");
    });
    expect(mockSignUpAction).toHaveBeenCalledWith("new@example.com", "securepass");
  });

  test("returns the result from signUpAction", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("existing@example.com", "pass");
    });
    expect(returnValue).toEqual({ success: false, error: "Email already registered" });
  });

  test("sets isLoading to false after completion", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "pass");
    });
    expect(result.current.isLoading).toBe(false);
  });

  test("does not navigate when sign-up fails", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Already exists" });
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("existing@example.com", "pass");
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("navigates to project after successful sign-up with no prior projects", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "signup-project" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("brand-new@example.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/signup-project");
  });

  test("migrates anon work on sign-up just like sign-in", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    const messages = [{ role: "user", content: "build a form" }];
    mockGetAnonWorkData.mockReturnValue({ messages, fileSystemData: { "/App.jsx": {} } });
    mockCreateProject.mockResolvedValue({ id: "migrated-proj" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages })
    );
    expect(mockClearAnonWork).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/migrated-proj");
  });
});
