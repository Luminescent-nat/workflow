export const ROLE_CATEGORY_ORDER: string[] = [
  "architecture",
  "frontend-ui",
  "frontend",
  "backend",
  "android",
  "fullstack",
  "spec",
  "qa",
  "devops",
  "video",
  "doc-reading",
  "doc-writing",
];

export const ROLE_CATEGORY_FALLBACK: Record<string, string> = {
  architecture: "架构设计",
  "frontend-ui": "前端UI",
  frontend: "前端开发",
  backend: "后端开发",
  android: "安卓开发",
  fullstack: "全栈协作",
  spec: "规格驱动",
  qa: "测试质量",
  devops: "运维发布",
  video: "视频处理",
  "doc-reading": "文档阅读",
  "doc-writing": "文档编写",
};

/** 用 local(key, fallback) 模式解析分类显示名。 */
export function categoryLabel(local: (key: string, fallback: string) => string, category: string): string {
  return local(`catalog.category.${category}`, ROLE_CATEGORY_FALLBACK[category] ?? category);
}

/** 按 ROLE_CATEGORY_ORDER 排序分类，未识别分类保持原顺序排最后。 */
export function sortedCategories(categories: Iterable<string>): string[] {
  const cats = [...new Set(categories)];
  return [
    ...ROLE_CATEGORY_ORDER.filter((c) => cats.includes(c)),
    ...cats.filter((c) => !ROLE_CATEGORY_ORDER.includes(c)),
  ];
}
