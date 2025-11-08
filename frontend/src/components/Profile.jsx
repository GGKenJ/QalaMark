import { useState, useEffect } from 'react';
import './Profile.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Profile = ({ onClose }) => {
  const [userData, setUserData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [userComments, setUserComments] = useState([]);
  const [completedWorks, setCompletedWorks] = useState([]);
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]); // Выбранные задачи для завершения
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  // Маппинг должностей к категориям
  const positionToCategories = {
    'police': ['road', 'transport', 'other'],
    'plumber': ['water', 'garbage'],
    'electrician': ['lighting'],
    'road_worker': ['road', 'transport'],
    'garbage_collector': ['garbage', 'ecology'],
    'lighting_worker': ['lighting'],
    'park_worker': ['parks', 'ecology'],
    'other': ['other']
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('qm_token');
      if (!token) return;

      // Загружаем данные пользователя
      const userResponse = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      let userInfo = null;
      if (userResponse.ok) {
        userInfo = await userResponse.json();
        setUserData(userInfo);
      }

      // Загружаем посты пользователя
      const postsResponse = await fetch(`${API_URL}/api/user/posts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (postsResponse.ok) {
        const posts = await postsResponse.json();
        setUserPosts(posts);
      }

      // Загружаем комментарии пользователя
      const commentsResponse = await fetch(`${API_URL}/api/user/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (commentsResponse.ok) {
        const comments = await commentsResponse.json();
        setUserComments(comments);
      }

      // Если сотрудник, загружаем задачи и завершенные работы
      if (userInfo && userInfo.role === 'employee') {
        const tasksResponse = await fetch(`${API_URL}/api/employee/tasks`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (tasksResponse.ok) {
          const tasks = await tasksResponse.json();
          setEmployeeTasks(tasks);
        }

        const worksResponse = await fetch(`${API_URL}/api/employee/completed-works`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (worksResponse.ok) {
          const works = await worksResponse.json();
          setCompletedWorks(works);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки данных профиля:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskToggle = (taskId) => {
    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  };

  const handleCompleteTasks = async () => {
    if (selectedTaskIds.length === 0) {
      alert('Выберите задачи для завершения');
      return;
    }

    try {
      const token = localStorage.getItem('qm_token');
      
      // Завершаем все выбранные задачи
      for (const taskId of selectedTaskIds) {
        const response = await fetch(`${API_URL}/api/employee/complete/${taskId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`Ошибка завершения задачи ${taskId}`);
        }
      }

      // Обновляем списки
      setSelectedTaskIds([]);
      await loadUserData();
    } catch (error) {
      console.error('Ошибка завершения задач:', error);
    }
  };

  const getPositionName = (positionId) => {
    const positions = {
      'police': 'Полицейский',
      'plumber': 'Сантехник',
      'electrician': 'Электрик',
      'road_worker': 'Дорожный рабочий',
      'garbage_collector': 'Сборщик мусора',
      'lighting_worker': 'Рабочий по освещению',
      'park_worker': 'Рабочий парков',
      'other': 'Другое'
    };
    return positions[positionId] || positionId;
  };

  const getCategoryName = (category) => {
    const names = {
      'road': 'Дорога',
      'ecology': 'Экология',
      'lighting': 'Освещение',
      'water': 'Вода',
      'garbage': 'Мусор',
      'transport': 'Транспорт',
      'parks': 'Парки',
      'other': 'Другое'
    };
    return names[category] || 'Другое';
  };

  if (loading) {
    return (
      <div className="profile-overlay" onClick={onClose}>
        <div className="profile-container" onClick={(e) => e.stopPropagation()}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-container" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <h2>Профиль</h2>
          <button className="profile-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="profile-tabs">
          <button 
            className={`profile-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Информация
          </button>
          <button 
            className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            Мои посты ({userPosts.length})
          </button>
          <button 
            className={`profile-tab ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            Комментарии ({userComments.length})
          </button>
          {userData?.role === 'employee' && (
            <>
              <button 
                className={`profile-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                Задачи ({employeeTasks.length})
              </button>
              <button 
                className={`profile-tab ${activeTab === 'works' ? 'active' : ''}`}
                onClick={() => setActiveTab('works')}
              >
                Выполнено ({completedWorks.length})
              </button>
            </>
          )}
        </div>

        <div className="profile-content">
          {activeTab === 'info' && userData && (
            <div className="profile-info">
              <div className="info-section">
                <h3>Основная информация</h3>
                <div className="info-item">
                  <span className="info-label">Телефон:</span>
                  <span className="info-value">{userData.phone || userData.username}</span>
                </div>
                {userData.full_name && (
                  <div className="info-item">
                    <span className="info-label">ФИО:</span>
                    <span className="info-value">{userData.full_name}</span>
                  </div>
                )}
                {userData.email && (
                  <div className="info-item">
                    <span className="info-label">Email:</span>
                    <span className="info-value">{userData.email}</span>
                  </div>
                )}
                <div className="info-item">
                  <span className="info-label">Роль:</span>
                  <span className="info-value">{userData.role === 'employee' ? 'Сотрудник' : 'Пользователь'}</span>
                </div>
                {userData.position && (
                  <div className="info-item">
                    <span className="info-label">Должность:</span>
                    <span className="info-value">{getPositionName(userData.position)}</span>
                  </div>
                )}
                {userData.created_at && (
                  <div className="info-item">
                    <span className="info-label">Дата регистрации:</span>
                    <span className="info-value">
                      {new Date(userData.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="profile-posts">
              {userPosts.length === 0 ? (
                <p className="empty-message">У вас пока нет постов</p>
              ) : (
                userPosts.map(post => (
                  <div key={post.id} className="profile-post-item">
                    <div className="post-header">
                      <h4>{post.title || 'Без названия'}</h4>
                      <span className="post-category">{getCategoryName(post.category)}</span>
                    </div>
                    {post.description && (
                      <p className="post-description">{post.description}</p>
                    )}
                    <div className="post-footer">
                      <span className="post-votes">👍 {post.votes || 0} 👎 {post.dislikes || 0}</span>
                      <span className="post-date">
                        {new Date(post.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="profile-comments">
              {userComments.length === 0 ? (
                <p className="empty-message">У вас пока нет комментариев</p>
              ) : (
                userComments.map(comment => (
                  <div key={comment.id} className="profile-comment-item">
                    <p className="comment-text">{comment.text}</p>
                    <div className="comment-footer">
                      <span className="comment-post">Пост: {comment.feedback_title || 'Удален'}</span>
                      <span className="comment-date">
                        {new Date(comment.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'tasks' && userData?.role === 'employee' && (
            <div className="profile-tasks">
              {employeeTasks.length === 0 ? (
                <p className="empty-message">Нет задач для вашей должности</p>
              ) : (
                <>
                  {employeeTasks.map(task => (
                    <div key={task.id} className="profile-task-item">
                      <div className="task-checkbox-wrapper">
                        <label className="task-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.includes(task.id)}
                            onChange={() => handleTaskToggle(task.id)}
                          />
                          <span>Выполнено</span>
                        </label>
                      </div>
                      <div className="task-header">
                        <h4>{task.title || 'Без названия'}</h4>
                        <span className="task-category">{getCategoryName(task.category)}</span>
                      </div>
                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}
                      <div className="task-footer">
                        <span className="task-date">
                          {new Date(task.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  ))}
                  {selectedTaskIds.length > 0 && (
                    <div className="complete-tasks-button-wrapper">
                      <button 
                        className="complete-tasks-button"
                        onClick={handleCompleteTasks}
                      >
                        ✓ Готово ({selectedTaskIds.length})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'works' && userData?.role === 'employee' && (
            <div className="profile-works">
              {completedWorks.length === 0 ? (
                <p className="empty-message">Вы еще не выполнили ни одной задачи</p>
              ) : (
                completedWorks.map(work => {
                  const feedback = work.feedback_data || {};
                  return (
                    <div key={work.id} className="profile-work-item">
                      <div className="work-header">
                        <h4>{feedback.title || 'Без названия'}</h4>
                        <span className="work-category">{getCategoryName(feedback.category)}</span>
                      </div>
                      {feedback.description && (
                        <p className="work-description">{feedback.description}</p>
                      )}
                      <div className="work-footer">
                        <span className="work-date">
                          Выполнено: {new Date(work.completed_at).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;

