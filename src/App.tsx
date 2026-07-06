import { Toaster } from "@shared/components/ui/toaster";
import { Toaster as Sonner } from "@shared/components/ui/sonner";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@shared/contexts/AuthContext";
import { FirebaseStatus } from "@shared/components/FirebaseStatus";

// Landing Page
import LandingPage from "./pages/LandingPage";

// Auth Pages
import Login from "./pages/Login";
import Register from "./pages/Register";

// Customer Pages
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import SelectShop from "./pages/customer/SelectShop";
import OrderWater from "./pages/customer/OrderWater";
import CreateSubscription from "./pages/customer/CreateSubscription";
import Subscriptions from "./pages/customer/Subscriptions";
import OrderTracking from "./pages/customer/OrderTracking";
import OrderHistory from "./pages/customer/OrderHistory";
import CustomerProfile from "./pages/customer/CustomerProfile";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <FirebaseStatus />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Customer Routes */}
            <Route path="/customer" element={<CustomerDashboard />} />
            <Route path="/customer/select-shop" element={<SelectShop />} />
            <Route path="/customer/order" element={<OrderWater />} />
            <Route path="/customer/subscribe" element={<CreateSubscription />} />
            <Route path="/customer/subscriptions" element={<Subscriptions />} />
            <Route path="/customer/tracking" element={<OrderTracking />} />
            <Route path="/customer/tracking/:orderId" element={<OrderTracking />} />
            <Route path="/customer/history" element={<OrderHistory />} />
            <Route path="/customer/profile" element={<CustomerProfile />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
