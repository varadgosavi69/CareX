import React, { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '../api/services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // On load, try to restore the session from the httpOnly refresh cookie:
    // refresh -> get a new access token -> fetch the current user.
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                await authService.refresh();
                const current = await authService.me();
                if (active) setUser(current);
            } catch {
                if (active) setUser(null);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const login = async (email, password) => {
        const current = await authService.login({ email, password });
        setUser(current);
        return current;
    };

    const register = async (payload) => {
        const current = await authService.register(payload);
        setUser(current);
        return current;
    };

    const logout = async () => {
        try {
            await authService.logout();
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
