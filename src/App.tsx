import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./App.css";
import Index from "./pages/Index";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import WorkerDashboard from "./pages/WorkerDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login/:role" element={<Login />} />
          <Route path="/srcadminpanel" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/workers" element={<AdminDashboard />} />
          <Route path="/admin/employees" element={<AdminDashboard />} />
          <Route path="/admin/pending" element={<AdminDashboard />} />
          <Route path="/admin/done" element={<AdminDashboard />} />
          <Route path="/admin/workers-finance" element={<AdminDashboard />} />
          <Route path="/admin/finances" element={<AdminDashboard />} />
          <Route path="/worker" element={<WorkerDashboard />} />
          <Route path="/employee" element={<EmployeeDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
