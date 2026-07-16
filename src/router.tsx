import { createHashRouter } from "react-router-dom";
import App from "@/App";
import Environment from "@/pages/Environment";
import Providers from "@/pages/Providers";
import Market from "@/pages/Market";
import Roles from "@/pages/Roles";
import Workspaces from "@/pages/Workspaces";
import Settings from "@/pages/Settings";
import Themes from "@/pages/Themes";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Environment /> },
      { path: "providers", element: <Providers /> },
      { path: "market", element: <Market /> },
      { path: "roles", element: <Roles /> },
      { path: "workspaces", element: <Workspaces /> },
      { path: "themes", element: <Themes /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
