import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import MealPlanPage from "@/pages/MealPlanPage";
import PantryPage from "@/pages/PantryPage";
import CookPage from "@/pages/CookPage";
import FamilyPage from "@/pages/FamilyPage";
import ChatPage from "@/pages/ChatPage";
import CartPage from "@/pages/CartPage";
import AppLayout from "@/components/AppLayout";

const Protected = ({ children }) => {
    const { token, loading } = useAuth();
    if (loading) return null;
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

const PublicOnly = ({ children }) => {
    const { token } = useAuth();
    if (token) return <Navigate to="/app" replace />;
    return children;
};

function App() {
    return (
        <div className="App">
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
                        <Route path="/app" element={<Protected><AppLayout /></Protected>}>
                            <Route index element={<ChatPage />} />
                            <Route path="cart" element={<CartPage />} />
                            <Route path="overview" element={<Dashboard />} />
                            <Route path="meals" element={<MealPlanPage />} />
                            <Route path="pantry" element={<PantryPage />} />
                            <Route path="cook" element={<CookPage />} />
                            <Route path="family" element={<FamilyPage />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </BrowserRouter>
                <Toaster position="top-right" richColors />
            </AuthProvider>
        </div>
    );
}

export default App;
