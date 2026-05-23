import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem("jarvis_token"));
    const [user, setUser] = useState(null);
    const [household, setHousehold] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const { data } = await api.get("/auth/me");
                setUser(data.user);
                setHousehold(data.household);
            } catch (e) {
                localStorage.removeItem("jarvis_token");
                setToken(null);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [token]);

    const handleAuthResult = (data) => {
        localStorage.setItem("jarvis_token", data.token);
        setToken(data.token);
        setUser(data.user);
        setHousehold(data.household);
        return data;
    };

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        return handleAuthResult(data);
    };

    const register = async (name, email, password, household_name) => {
        const { data } = await api.post("/auth/register", {
            name, email, password, household_name,
        });
        return handleAuthResult(data);
    };

    const joinHome = async (name, email, password, invite_code) => {
        const { data } = await api.post("/auth/join", {
            name, email, password, invite_code,
        });
        return handleAuthResult(data);
    };

    const logout = () => {
        localStorage.removeItem("jarvis_token");
        setToken(null);
        setUser(null);
        setHousehold(null);
    };

    return (
        <AuthContext.Provider
            value={{ token, user, household, loading, login, register, joinHome, logout, setHousehold }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
