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

