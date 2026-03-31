import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/index";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Sonner Toaster handles all those toast.success/error calls */}
      <Toaster position="bottom-right" richColors /> 
      
      <BrowserRouter>
        <div className="min-h-screen bg-background flex flex-col overflow-hidden">
          {/* Notice I removed the <header> here. 
            The TopBar inside Index.tsx will now be your main navigation. 
          */}
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Index />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;