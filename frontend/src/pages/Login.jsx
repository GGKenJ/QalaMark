import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  // Отслеживаем изменения полей для очистки ошибки
  const phoneValue = watch('phone');
  const passwordValue = watch('password');
  
  useEffect(() => {
    if (error && (phoneValue || passwordValue)) {
      setError('');
    }
  }, [phoneValue, passwordValue, error]);

  const onSubmit = async (data, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setError('');
    
    try {
      const result = await login(data);
      
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Неверный номер телефона или пароль');
      }
    } catch (err) {
      console.error('Ошибка при входе:', err);
      setError('Произошла ошибка. Попробуйте еще раз.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Вход в систему
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Или{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              создайте новый аккаунт
            </Link>
          </p>
        </div>
        
        <form 
          className="mt-8 space-y-6" 
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit(onSubmit)(e);
          }}
          noValidate
        >
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="phone" className="sr-only">
                Номер телефона
              </label>
              <input
                {...register('phone', { 
                  required: 'Номер телефона обязателен',
                  pattern: {
                    value: /^[\d\s\-\+\(\)]+$/,
                    message: 'Неверный формат номера телефона'
                  }
                })}
                type="tel"
                autoComplete="tel"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Номер телефона"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>
            
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Пароль
              </label>
              <input
                {...register('password', { required: 'Пароль обязателен' })}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Пароль"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>
          
          {/* Сообщение об ошибке под полем пароля */}
          {(errors.password || error) && (
            <p className="mt-1 text-sm text-red-600">
              {errors.password?.message || error}
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Вход...' : 'Войти'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;