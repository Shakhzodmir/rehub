import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ClinicProvider } from "@/context/ClinicContext";
import { SessionsProvider } from "@/context/SessionsContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <ClinicProvider>
            <SessionsProvider>
              <App />
              <Toaster />
            </SessionsProvider>
          </ClinicProvider>
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
