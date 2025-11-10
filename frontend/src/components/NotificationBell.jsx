import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { io } from 'socket.io-client';
import './NotificationBell.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const NotificationBell = () => {
  const { user, checkAuth } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Проверяем авторизацию при загрузке компонента
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('qm_token');
      if (token && !user) {
        console.log('🔔 Проверяем авторизацию при загрузке NotificationBell...');
        await checkAuth();
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      console.log('🔔 Пользователь не авторизован, уведомления не загружаются');
      return;
    }
    console.log('🔔 Пользователь авторизован, загружаем уведомления...', { userId: user.id });
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    try {
      const token = localStorage.getItem('qm_token');
      if (!token) {
        console.log('🔔 Нет токена для загрузки уведомлений');
        return;
      }

      console.log('🔔 Загрузка уведомлений...', { API_URL, token: token.substring(0, 20) + '...' });

      const response = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('🔔 Ответ сервера:', { status: response.status, ok: response.ok });

      if (response.ok) {
        const data = await response.json();
        console.log('🔔 Получены уведомления:', { 
          count: data.notifications?.length || 0, 
          unreadCount: data.unreadCount || 0,
          notifications: data.notifications 
        });
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка парсинга ответа' }));
        console.error('🔔 Ошибка загрузки уведомлений:', errorData);
      }
    } catch (error) {
      console.error('🔔 Ошибка загрузки уведомлений:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('qm_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Ошибка при отметке уведомления:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('qm_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Ошибка при отметке всех уведомлений:', error);
    }
  };

  // Подключение к WebSocket для новых уведомлений
  useEffect(() => {
    if (!user) return;

    const socket = io(API_URL, { 
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000
    });

    socket.on('connect', () => {
      console.log('🔔 NotificationBell WebSocket подключен:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔔 NotificationBell WebSocket отключен:', reason);
    });

    socket.on('notification:new', (data) => {
      console.log('🔔 Получено WebSocket событие notification:new:', data);
      if (data.user_id === user.id) {
        console.log('🔔 Уведомление для текущего пользователя, загружаем...');
        loadNotifications();
        // Обновляем счетчик непрочитанных
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => {
      console.log('🔔 Отключение NotificationBell WebSocket');
      socket.disconnect();
    };
  }, [user]);

  const handleToggle = () => {
    console.log('🔔 Кнопка уведомлений нажата', { user, isOpen, notificationsCount: notifications.length });
    
    const newIsOpen = !isOpen;
    console.log('🔔 Новое состояние isOpen:', newIsOpen);
    setIsOpen(newIsOpen);
    
    // Если открываем модальное окно и пользователь авторизован, загружаем уведомления
    if (newIsOpen && user) {
      console.log('🔔 Открываем модальное окно, загружаем уведомления...');
      loadNotifications();
    }
  };

  return (
    <>
      <div className="notification-bell-container">
        <button 
          className="notification-bell-button"
          onClick={handleToggle}
          aria-label="Уведомления"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M13.73 21a2 2 0 0 1-3.46 0" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          {user && unreadCount > 0 && (
            <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="notification-modal-overlay" onClick={() => {
          console.log('🔔 Закрытие модального окна по клику на overlay');
          setIsOpen(false);
        }}>
          <div className="notification-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="notification-modal-header">
              <h2>Уведомления</h2>
              <div className="notification-modal-actions">
                {user && unreadCount > 0 && (
                  <button className="mark-all-read-button" onClick={handleMarkAllRead}>
                    Отметить все прочитанными
                  </button>
                )}
                <button className="notification-modal-close" onClick={() => {
                  console.log('🔔 Закрытие модального окна по кнопке');
                  setIsOpen(false);
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="notification-modal-content">
              {!user ? (
                <div className="notification-empty">
                  <p>Необходимо войти в систему для просмотра уведомлений</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty">
                  <p>У вас пока нет уведомлений</p>
                </div>
              ) : (
                <div className="notification-list">
                  {notifications.map(notification => (
                    <div 
                      key={notification.id} 
                      className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                      onClick={() => {
                        if (!notification.is_read) {
                          handleMarkAsRead(notification.id);
                        }
                        if (notification.link) {
                          window.location.href = notification.link;
                        }
                      }}
                    >
                      <div className="notification-content">
                        <p className="notification-message">{notification.message}</p>
                        <span className="notification-time">
                          {new Date(notification.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {!notification.is_read && (
                        <div className="notification-dot"></div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;

