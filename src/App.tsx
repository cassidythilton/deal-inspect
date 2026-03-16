import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/layouts/MainLayout";
import CommandCenter from "@/pages/CommandCenter";
import TDRWorkspace from "@/pages/TDRWorkspace";
import TDRAdmin from "@/pages/TDRAdmin";
import Documentation from "@/pages/Documentation";
import Settings from "@/pages/Settings";
import NotFound from "./pages/NotFound";
import { DomoUserCtx, useDomoUserInit } from "@/hooks/useDomoUser";

const queryClient = new QueryClient();

function AppInner() {
  const domoUser = useDomoUserInit();
  return (
    <DomoUserCtx.Provider value={domoUser}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<CommandCenter />} />
              <Route path="/workspace" element={<TDRWorkspace />} />
              <Route path="/admin" element={<TDRAdmin />} />
              <Route path="/docs" element={<Documentation />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </DomoUserCtx.Provider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppInner />
  </QueryClientProvider>
);

export default App;
