import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';
import './LoginOverlay.css';

const LoginOverlay = ({ onLoginSuccess }) => {
  const { register: registerForm, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm();
  const { login, register: registerUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [error, setError] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const password = watch('password');
  const role = watch('role');
  
  // Должности для сотрудников
  const POSITIONS = [
    { id: 'police', name: 'Полицейский' },
    { id: 'plumber', name: 'Сантехник' },
    { id: 'electrician', name: 'Электрик' },
    { id: 'road_worker', name: 'Дорожный рабочий' },
    { id: 'garbage_collector', name: 'Сборщик мусора' },
    { id: 'lighting_worker', name: 'Рабочий по освещению' },
    { id: 'park_worker', name: 'Рабочий парков' },
    { id: 'other', name: 'Другое' }
  ];

  // Очистка ошибки при изменении полей
  const phoneValue = watch('phone');
  const passwordValue = watch('password');
  
  useEffect(() => {
    if (error && (phoneValue || passwordValue)) {
      setError('');
    }
  }, [phoneValue, passwordValue, error]);

  const onSubmit = async (data) => {
    setError('');
    
    try {
      let result;
      if (isLoginMode) {
        result = await login(data);
      } else {
        result = await registerUser(data);
      }
      
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.error || 'Произошла ошибка');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      setError('Произошла ошибка. Попробуйте еще раз.');
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <h2>{isLoginMode ? 'Вход в систему' : 'Регистрация'}</h2>
            <p className="login-subtitle">
              {isLoginMode ? (
                <>
                  Нет аккаунта?{' '}
                  <button 
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setIsLoginMode(false);
                      setError('');
                    }}
                  >
                    Зарегистрируйтесь
                  </button>
                </>
              ) : (
                <>
                  Уже есть аккаунт?{' '}
                  <button 
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setIsLoginMode(true);
                      setError('');
                    }}
                  >
                    Войдите
                  </button>
                </>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {!isLoginMode && (
              <>
                <div className="form-group">
                  <label htmlFor="full_name">ФИО</label>
                  <input
                    {...registerForm('full_name')}
                    type="text"
                    id="full_name"
                    placeholder="Введите ваше полное имя"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="phone">Номер телефона</label>
              <input
                {...registerForm('phone', { 
                  required: 'Номер телефона обязателен',
                  pattern: {
                    value: /^[\d\s\-\+\(\)]+$/,
                    message: 'Неверный формат номера телефона'
                  }
                })}
                type="tel"
                id="phone"
                autoComplete="tel"
                placeholder="+7 (___) ___-__-__"
                className={errors.phone ? 'input-error' : ''}
              />
              {errors.phone && (
                <span className="field-error">{errors.phone.message}</span>
              )}
            </div>

            {!isLoginMode && (
              <>
                <div className="form-group">
                  <label htmlFor="role">Роль</label>
                  <select
                    {...registerForm('role', { required: 'Выберите роль' })}
                    id="role"
                    className={errors.role ? 'input-error' : ''}
                  >
                    <option value="user">Обычный пользователь</option>
                    <option value="employee">Сотрудник</option>
                  </select>
                  {errors.role && (
                    <span className="field-error">{errors.role.message}</span>
                  )}
                </div>

                {role === 'employee' && (
                  <div className="form-group">
                    <label htmlFor="position">Должность *</label>
                    <select
                      {...registerForm('position', { 
                        required: role === 'employee' ? 'Выберите должность' : false 
                      })}
                      id="position"
                      className={errors.position ? 'input-error' : ''}
                    >
                      <option value="">Выберите должность</option>
                      {POSITIONS.map(pos => (
                        <option key={pos.id} value={pos.id}>{pos.name}</option>
                      ))}
                    </select>
                    {errors.position && (
                      <span className="field-error">{errors.position.message}</span>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <div className="password-input-wrapper">
                <input
                  {...registerForm('password', { 
                    required: 'Пароль обязателен',
                    ...(isLoginMode ? {} : {
                      minLength: { value: 6, message: 'Минимум 6 символов' },
                      pattern: {
                        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                        message: 'Пароль должен содержать заглавную букву, строчную букву и цифру'
                      }
                    })
                  })}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                  placeholder={isLoginMode ? 'Введите пароль' : 'Минимум 6 символов'}
                  className={errors.password ? 'input-error' : ''}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
              {errors.password && (
                <span className="field-error">{errors.password.message}</span>
              )}
            </div>

            {!isLoginMode && (
              <>
                <div className="form-group">
                  <label htmlFor="confirmPassword">Подтвердите пароль</label>
                  <div className="password-input-wrapper">
                    <input
                      {...registerForm('confirmPassword', { 
                        required: 'Подтверждение пароля обязательно',
                        validate: value => value === password || 'Пароли не совпадают'
                      })}
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      autoComplete="new-password"
                      placeholder="Повторите пароль"
                      className={errors.confirmPassword ? 'input-error' : ''}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <span className="field-error">{errors.confirmPassword.message}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    {...registerForm('email', {
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Неверный формат email'
                      }
                    })}
                    type="email"
                    id="email"
                    placeholder="example@mail.com"
                    className={errors.email ? 'input-error' : ''}
                  />
                  {errors.email && (
                    <span className="field-error">{errors.email.message}</span>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="submit-button"
            >
              {isSubmitting 
                ? (isLoginMode ? 'Вход...' : 'Регистрация...') 
                : (isLoginMode ? 'Войти' : 'Зарегистрироваться')
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginOverlay;

