import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Функция для сохранения токена
  const saveToken = (token) => {
    localStorage.setItem('qm_token', token);
  };

  // Функция для получения токена
  const getToken = () => {
    return localStorage.getItem('qm_token');
  };

  // Функция для удаления токена
  const removeToken = () => {
    localStorage.removeItem('qm_token');
  };

  // Регистрация
  const register = useCallback(async (data) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: data.phone, // Используем телефон как username
          password: data.password,
          role: data.role || 'user',
          position: data.position || null,
          full_name: data.full_name || null,
          email: data.email || null,
          phone: data.phone,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.token) {
          saveToken(result.token);
          setUser(result.user || { username: data.phone });
        }
        return { success: true, user: result.user };
      } else {
        return { success: false, error: result.error || 'Ошибка регистрации' };
      }
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      return { success: false, error: 'Ошибка подключения к серверу' };
    } finally {
      setLoading(false);
    }
  }, []);

  // Вход
  const login = useCallback(async (data) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: data.phone, // Используем телефон как username
          password: data.password,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.token) {
          saveToken(result.token);
          setUser(result.user || { username: data.phone });
        }
        return { success: true, user: result.user };
      } else {
        return { success: false, error: result.error || 'Неверный номер телефона или пароль' };
      }
    } catch (error) {
      console.error('Ошибка входа:', error);
      return { success: false, error: 'Ошибка подключения к серверу' };
    } finally {
      setLoading(false);
    }
  }, []);

  // Выход
  const logout = useCallback(() => {
    removeToken();
    setUser(null);
  }, []);

  // Проверка авторизации
  const checkAuth = useCallback(async () => {
    const token = getToken();
    if (!token) {
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return true;
      } else {
        removeToken();
        return false;
      }
    } catch (error) {
      console.error('Ошибка проверки авторизации:', error);
      removeToken();
      return false;
    }
  }, []);

  return {
    user,
    loading,
    register,
    login,
    logout,
    checkAuth,
    isAuthenticated: !!getToken(),
  };
};

