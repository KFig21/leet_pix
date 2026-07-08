import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { router } from "@/router";
import "@styles/global.scss";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PreferencesProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
