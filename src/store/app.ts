import { create } from "zustand";

export type Tool = "claude" | "codex";

interface AppState {
  /** 当前在供应商等页面选中的工具分组 */
  tool: Tool;
  setTool: (tool: Tool) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tool: "claude",
  setTool: (tool) => set({ tool }),
}));
