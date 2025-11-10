import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoginOverlay from '../components/LoginOverlay';
import MobileFilters from '../components/MobileFilters';
import Profile from '../components/Profile';
import NotificationBell from '../components/NotificationBell';
import { io } from 'socket.io-client';
import './MapPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Список городов
const CITIES = [
  { 
    id: 'kyzylorda', 
    name: 'Кызылорда', 
    lat: 45.0192, 
    lon: 65.5083,
    districts: [
      { id: 'center', name: 'Центральный район' },
      { id: 'north', name: 'Северный район' },
      { id: 'south', name: 'Южный район' },
      { id: 'east', name: 'Восточный район' },
      { id: 'west', name: 'Западный район' }
    ]
  },
  { 
    id: 'almaty', 
    name: 'Алматы', 
    lat: 43.2220, 
    lon: 76.8512,
    districts: [
      { id: 'center', name: 'Центральный район' },
      { id: 'medeu', name: 'Медеуский район' },
      { id: 'turksib', name: 'Турксибский район' }
    ]
  },
  { 
    id: 'astana', 
    name: 'Астана', 
    lat: 51.1694, 
    lon: 71.4491,
    districts: [
      { id: 'center', name: 'Центральный район' },
      { id: 'saryarka', name: 'Сарыаркинский район' }
    ]
  },
  { 
    id: 'shymkent', 
    name: 'Шымкент', 
    lat: 42.3419, 
    lon: 69.5901,
    districts: [
      { id: 'center', name: 'Центральный район' },
      { id: 'north', name: 'Северный район' }
    ]
  },
  { 
    id: 'karaganda', 
    name: 'Караганда', 
    lat: 49.8014, 
    lon: 73.1049,
    districts: [
      { id: 'center', name: 'Центральный район' },
      { id: 'kazbek', name: 'Казыбекбийский район' }
    ]
  },
];

// Расширенный список категорий
const CATEGORIES = [
  { id: 'road', name: 'Дорога', color: 'orange' },
  { id: 'ecology', name: 'Экология', color: 'green' },
  { id: 'lighting', name: 'Освещение', color: 'yellow' },
  { id: 'water', name: 'Вода', color: 'blue' },
  { id: 'garbage', name: 'Мусор', color: 'brown' },
  { id: 'transport', name: 'Транспорт', color: 'red' },
  { id: 'parks', name: 'Парки', color: 'darkGreen' },
  { id: 'other', name: 'Другое', color: 'gray' }
];

// Маппинг должностей сотрудников к категориям проблем
const POSITION_TO_CATEGORIES = {
  'police': ['road', 'transport', 'other'],
  'plumber': ['water'],
  'electrician': ['lighting'],
  'road_worker': ['road'],
  'garbage_collector': ['garbage', 'ecology'],
  'lighting_worker': ['lighting'],
  'park_worker': ['parks', 'ecology'],
  'other': ['other']
};

const MapPage = () => {
  const { isAuthenticated, checkAuth, user } = useAuth();
  const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
  const [activeTab, setActiveTab] = useState('map');
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(['all']); // Множественный выбор
  const [selectedCity, setSelectedCity] = useState('kyzylorda');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [userLocation, setUserLocation] = useState(null);
  const [currentUserCity, setCurrentUserCity] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState('map'); // По умолчанию детальная карта
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSolutionModal, setShowSolutionModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [newFeedbackLocation, setNewFeedbackLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortByLikes, setSortByLikes] = useState('most-likes'); // 'none', 'most-likes', 'least-likes'
  const [userVotes, setUserVotes] = useState({}); // { feedbackId: 'like' | 'dislike' | null }
  const [solutionFormData, setSolutionFormData] = useState({ description: '', photo: null });
  const [commentText, setCommentText] = useState(''); // Текст комментария для добавления
  // Начальное состояние формы
  const initialFormData = {
    title: '',
    description: '',
    categories: [],
    photo: null,
    video: null,
    address: '',
    is_anonymous: false
  };

  const [formData, setFormData] = useState(initialFormData);

  // Функция для сброса формы
  const resetForm = () => {
    setFormData(initialFormData);
    setNewFeedbackLocation(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };
  const [showProfile, setShowProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const addressInputRef = useRef(null);

  // Проверка авторизации при загрузке
  useEffect(() => {
    const checkUserAuth = async () => {
      const token = localStorage.getItem('qm_token');
      if (token) {
        const authResult = await checkAuth();
        setIsAuthenticatedState(authResult);
        if (authResult) {
          // Загружаем данные пользователя
          try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (response.ok) {
              const userData = await response.json();
              setCurrentUser(userData);
            }
          } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
          }
        }
      } else {
        setIsAuthenticatedState(false);
      }
    };
    checkUserAuth();
  }, [checkAuth]);

  // Обработчик успешного логина
  const handleLoginSuccess = async () => {
    const authResult = await checkAuth();
    setIsAuthenticatedState(authResult);
    if (authResult) {
      // Загружаем данные пользователя
      try {
        const token = localStorage.getItem('qm_token');
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
      }
    }
  };

  // Определение местоположения пользователя
  useEffect(() => {
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            // Определяем текущий город пользователя
            let userCity = null;
            for (const city of CITIES) {
              // Простая проверка: если координаты близки к городу
              const distance = Math.sqrt(
                Math.pow(lat - city.lat, 2) + Math.pow(lon - city.lon, 2)
              );
              if (distance < 0.5) { // Примерно 50 км
                userCity = city.id;
                break;
              }
            }
            
            setCurrentUserCity(userCity);
            setUserLocation({
              lat,
              lon,
              name: 'Ваше местоположение'
            });
          },
          (error) => {
            console.log('Геолокация недоступна:', error);
            const city = CITIES.find(c => c.id === selectedCity) || CITIES[0];
            setUserLocation({
              lat: city.lat,
              lon: city.lon,
              name: city.name
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        const city = CITIES.find(c => c.id === selectedCity) || CITIES[0];
        setUserLocation({
          lat: city.lat,
          lon: city.lon,
          name: city.name
        });
      }
    };

    getLocation();
  }, []);

  // Загрузка данных с API
  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const response = await fetch(`${API_URL}/api/feedbacks`);
        if (response.ok) {
          const data = await response.json();
          setFeedbacks(data);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        setFeedbacks([]);
      }
    };

    fetchFeedbacks();
  }, []);

  // Ref для хранения socket и selectedFeedback
  const socketRef = useRef(null);
  const selectedFeedbackRef = useRef(null);

  // Обновляем ref при изменении selectedFeedback
  useEffect(() => {
    selectedFeedbackRef.current = selectedFeedback;
  }, [selectedFeedback]);

  // WebSocket подключение для обновления в реальном времени
  useEffect(() => {
    // Создаем подключение только один раз
    if (socketRef.current) {
      return;
    }

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket подключен:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket отключен:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения WebSocket:', error);
    });

    // Слушаем новую жалобу
    socket.on('feedback:new', (newFeedback) => {
      console.log('📝 Новая жалоба через WebSocket:', newFeedback);
      // Отмечаем как новую для мигающей метки
      newFeedback.is_new = true;
      
      // Если категория нового фидбека не выбрана, добавляем её в выбранные
      setSelectedCategories(prev => {
        if (prev.includes('all') || prev.includes(newFeedback.category)) {
          return prev;
        }
        console.log('⚠️ Категория нового фидбека не выбрана (WebSocket), добавляем её');
        return [...prev, newFeedback.category];
      });
      
      setFeedbacks(prev => {
        // Проверяем, нет ли уже такой жалобы
        const exists = prev.find(f => f.id === newFeedback.id);
        if (exists) {
          console.log('⚠️ Фидбек уже существует (WebSocket), обновляем его');
          // Обновляем существующий фидбек, сохраняя is_new
          return prev.map(f => f.id === newFeedback.id ? { ...f, ...newFeedback, is_new: true } : f);
        }
        console.log('📝 Добавляем новый фидбек через WebSocket, всего:', prev.length + 1);
        return [newFeedback, ...prev];
      });
      
      // Маркеры обновятся автоматически через useEffect при изменении feedbacks
    });

    // Слушаем обновление жалобы
    socket.on('feedback:updated', (updatedFeedback) => {
      console.log('🔄 Жалоба обновлена:', updatedFeedback);
      // Убираем флаг is_new при обновлении
      updatedFeedback.is_new = false;
      setFeedbacks(prev => 
        prev.map(f => f.id === updatedFeedback.id ? updatedFeedback : f)
      );
      
      // Обновляем маркеры на карте
      if (mapInstanceRef.current) {
        updateMarkers();
      }
    });

    // Слушаем новое решение
    socket.on('solution:new', (newSolution) => {
      console.log('🔧 Новое решение:', newSolution);
      const currentSelected = selectedFeedbackRef.current;
      if (currentSelected && currentSelected.id === newSolution.feedback_id) {
        setSolutions(prev => {
          const exists = prev.find(s => s.id === newSolution.id);
          return exists ? prev : [newSolution, ...prev];
        });
      }
    });

    // Слушаем обновление решения
    socket.on('solution:updated', (updatedSolution) => {
      console.log('🔄 Решение обновлено:', updatedSolution);
      const currentSelected = selectedFeedbackRef.current;
      if (currentSelected && currentSelected.id === updatedSolution.feedback_id) {
        setSolutions(prev => 
          prev.map(s => s.id === updatedSolution.id ? updatedSolution : s)
        );
      }
    });

    // Слушаем новые уведомления
    socket.on('notification:new', (data) => {
      console.log('🔔 Новое уведомление:', data);
    });

    // Слушаем завершение жалобы
    socket.on('feedback:completed', (completedFeedback) => {
      console.log('✅ Жалоба завершена:', completedFeedback);
      completedFeedback.is_new = false;
      setFeedbacks(prev => 
        prev.map(f => f.id === completedFeedback.id ? completedFeedback : f)
      );
      const currentSelected = selectedFeedbackRef.current;
      if (currentSelected && currentSelected.id === completedFeedback.id) {
        setSelectedFeedback(completedFeedback);
      }
      
      // Обновляем маркеры на карте
      if (mapInstanceRef.current) {
        updateMarkers();
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Убрали зависимость selectedFeedback

  // Обновляем выбранную жалобу при изменении feedbacks
  useEffect(() => {
    if (selectedFeedback) {
      const updated = feedbacks.find(f => f.id === selectedFeedback.id);
      if (updated) {
        setSelectedFeedback(updated);
      }
    }
  }, [feedbacks]);

  // Загрузка Яндекс.Карт
  useEffect(() => {
    if (document.querySelector('script[src*="api-maps.yandex.ru"]')) {
      if (typeof window.ymaps !== 'undefined') {
        window.ymaps.ready(() => {
          setMapReady(true);
        });
      }
      return;
    }

    if (typeof window.ymaps !== 'undefined') {
      window.ymaps.ready(() => {
        setMapReady(true);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
    script.onload = () => {
      if (window.ymaps) {
        window.ymaps.ready(() => {
          setMapReady(true);
        });
      }
    };
    script.onerror = () => {
      console.error('Ошибка загрузки Яндекс.Карт');
    };
    document.body.appendChild(script);
  }, []);

  // Инициализация карты
  useEffect(() => {
    if (activeTab !== 'map' || !mapReady || !window.ymaps) return;
    if (!mapRef.current) return;
    if (!userLocation) return;

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }

      try {
        const center = [userLocation.lat, userLocation.lon];

        // Создаем карту без typeSelector и fullscreenControl
        const map = new window.ymaps.Map(mapRef.current, {
          center: center,
          zoom: 15,
          controls: ['zoomControl'] // Только zoom
        }, {
          suppressMapOpenBlock: true,
          yandexMapAutoSwitch: true,
          yandexMapDisablePoiInteractivity: true
        });

        // Устанавливаем тип карты (по умолчанию детальная)
        updateMapType(map, mapStyle);

        mapInstanceRef.current = map;
        
        addUserLocationMarker();
        updateMarkers();

        map.events.add('dblclick', (e) => {
          const coords = e.get('coords');
          setNewFeedbackLocation({
            lat: coords[0],
            lon: coords[1]
          });
          setShowAddModal(true);
        });

        map.events.add('click', (e) => {
          map.balloon.close();
        });
      } catch (error) {
        console.error('Ошибка создания карты:', error);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [activeTab, mapReady, userLocation, mapStyle]);

  // Обновление маркеров при изменении категории или данных
  useEffect(() => {
    if (mapInstanceRef.current && mapReady && window.ymaps) {
      console.log('🔄 Обновление маркеров, всего фидбеков:', feedbacks.length);
      updateMarkers();
    }
  }, [feedbacks, selectedCategories, mapReady]);

  // Обновление типа карты
  const updateMapType = (map, style) => {
    switch (style) {
      case 'hybrid':
        map.setType('yandex#hybrid', { checkZoomRange: true });
        break;
      case 'map':
        map.setType('yandex#map', { checkZoomRange: true });
        break;
      default:
        map.setType('yandex#map', { checkZoomRange: true });
    }
  };

  // Обновление центра карты при смене города
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const city = CITIES.find(c => c.id === selectedCity);
    if (city) {
      // Если выбран текущий город пользователя - перемещаемся к его местоположению
      if (currentUserCity === selectedCity && userLocation && userLocation.name === 'Ваше местоположение') {
        mapInstanceRef.current.setCenter([userLocation.lat, userLocation.lon], 15, {
          duration: 500
        });
      } else {
        // Иначе перемещаемся к центру города
        mapInstanceRef.current.setCenter([city.lat, city.lon], 15, {
          duration: 500
        });
      }
    }
  }, [selectedCity, currentUserCity, userLocation]);

  const addUserLocationMarker = () => {
    if (!mapInstanceRef.current || !window.ymaps || !userLocation) return;

    if (userMarkerRef.current) {
      mapInstanceRef.current.geoObjects.remove(userMarkerRef.current);
    }

    const marker = new window.ymaps.Placemark(
      [userLocation.lat, userLocation.lon],
      {
        balloonContentHeader: userLocation.name,
        balloonContentBody: `${userLocation.lat.toFixed(6)}, ${userLocation.lon.toFixed(6)}`
      },
      {
        preset: 'islands#blueCircleDotIcon',
        draggable: false
      }
    );

    mapInstanceRef.current.geoObjects.add(marker);
    userMarkerRef.current = marker;
  };

  const updateMarkers = () => {
    if (!mapInstanceRef.current || !window.ymaps) return;

    markersRef.current.forEach(marker => {
      mapInstanceRef.current.geoObjects.remove(marker);
    });
    markersRef.current = [];

    // Фильтруем по категориям и исключаем archived (кроме анонимных - они остаются, но автор скрыт)
    const filtered = selectedCategories.includes('all')
      ? feedbacks.filter(f => f.status !== 'archived' || f.is_anonymous)
      : feedbacks.filter(f => selectedCategories.includes(f.category) && (f.status !== 'archived' || f.is_anonymous));

    console.log('🗺️ Обновление маркеров:', {
      всего_фидбеков: feedbacks.length,
      выбранные_категории: selectedCategories,
      отфильтровано: filtered.length,
      фидбеки: feedbacks.map(f => ({ id: f.id, category: f.category, status: f.status, is_new: f.is_new }))
    });

    filtered.forEach(feedback => {
      try {
        const category = CATEGORIES.find(c => c.id === feedback.category) || CATEGORIES[CATEGORIES.length - 1];
        
        // Определяем цвет маркера в зависимости от категории и статуса
        // Каждая категория имеет свой цвет
        let markerColor = category.color;
        let markerPreset = `islands#${markerColor}CircleDotIcon`;
        
        // Если жалоба решена (но не archived) - серый цвет
        if ((feedback.status === 'completed' || feedback.status === 'resolved') && feedback.status !== 'archived') {
          markerColor = 'gray';
          markerPreset = 'islands#grayCircleDotIcon';
        }
        // Если archived и анонимная - показываем серым (не исчезает)
        else if (feedback.status === 'archived' && feedback.is_anonymous) {
          markerColor = 'gray';
          markerPreset = 'islands#grayCircleDotIcon';
        }
        // Для новых жалоб используем цвет категории (не красный)
        // Мигание будет добавлено отдельно через shouldMarkerBlink
        
        const marker = new window.ymaps.Placemark(
          [feedback.lat, feedback.lon],
          {
            balloonContentHeader: feedback.title || 'Без названия',
            balloonContentBody: `${getCategoryName(feedback.category)}${feedback.description ? ': ' + feedback.description : ''}${feedback.status === 'completed' || feedback.status === 'resolved' ? ' (Решено)' : ''}${feedback.is_new ? ' ⚠️ НОВАЯ ПРОБЛЕМА - проверьте!' : ''}`,
            hintContent: feedback.title || 'Без названия'
          },
          {
            preset: markerPreset,
            draggable: false
          }
        );

        // Добавляем анимацию мигания для новых жалоб
        // Мигают только метки, которые должны мигать для текущего пользователя
        if (shouldMarkerBlink(feedback)) {
          // Создаем интервал для мигания метки
          let isVisible = true;
          const blinkInterval = setInterval(() => {
            if (marker && mapInstanceRef.current) {
              isVisible = !isVisible;
              marker.options.set('visible', isVisible);
            } else {
              clearInterval(blinkInterval);
            }
          }, 500);
          
          // Останавливаем мигание через 30 секунд или когда жалоба получит 3+ лайка
          setTimeout(() => {
            clearInterval(blinkInterval);
            if (marker) {
              marker.options.set('visible', true);
            }
          }, 30000);
        }

        marker.events.add('click', () => {
          handleViewFeedback(feedback);
        });

        mapInstanceRef.current.geoObjects.add(marker);
        markersRef.current.push(marker);
      } catch (error) {
        console.error('Ошибка добавления маркера:', error);
      }
    });
  };

  const getCategoryName = (category) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat ? cat.name : 'Другое';
  };

  // Объединенная функция для голосования
  const handleVote = async (id, voteType) => {
    const currentVote = userVotes[id];
    // Если уже проголосовал таким же образом, убираем голос
    if (currentVote === voteType) {
      setUserVotes(prev => ({ ...prev, [id]: null }));
      return;
    }
    
    try {
      const token = localStorage.getItem('qm_token');
      const response = await fetch(`${API_URL}/api/feedback/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ type: voteType })
      });

      if (response.ok) {
        const updated = await response.json();
        setFeedbacks(prev => 
          prev.map(f => f.id === id ? updated : f)
        );
        if (selectedFeedback && selectedFeedback.id === id) {
          setSelectedFeedback(updated);
        }
        setUserVotes(prev => ({ ...prev, [id]: voteType }));
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка при голосовании' }));
        console.error('Ошибка при голосовании:', errorData.error || 'Неизвестная ошибка');
      }
    } catch (error) {
      console.error('Ошибка при голосовании:', error);
    }
  };

  const handleLike = (id) => handleVote(id, 'like');
  const handleDislike = (id) => handleVote(id, 'dislike');

  // Функция для расчета расстояния между двумя точками (в метрах)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Радиус Земли в метрах
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Расстояние в метрах
  };

  // Функция для проверки, может ли сотрудник решать проблему данной категории
  const canEmployeeSolveFeedback = (feedback) => {
    if (!user || user.role !== 'employee' || !user.position) return false;
    const employeeCategories = POSITION_TO_CATEGORIES[user.position] || [];
    return employeeCategories.includes(feedback.category);
  };

  // Функция для проверки, находится ли сотрудник рядом с жалобой (в радиусе 500м)
  const isEmployeeNearFeedback = (feedback) => {
    if (!userLocation || !user || user.role !== 'employee') return false;
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lon,
      feedback.lat,
      feedback.lon
    );
    return distance <= 500; // 500 метров
  };

  // Функция для проверки, должна ли метка мигать для текущего пользователя
  const shouldMarkerBlink = (feedback) => {
    // Мигают только новые жалобы (is_new) или с < 3 лайками и статусом 'new'
    if (!feedback.is_new && !(feedback.votes < 3 && feedback.status === 'new')) {
      return false;
    }

    // Для сотрудников: мигать только метки их категории (всегда, независимо от расстояния)
    if (user && user.role === 'employee' && user.position) {
      const employeeCategories = POSITION_TO_CATEGORIES[user.position] || [];
      if (employeeCategories.includes(feedback.category)) {
        console.log(`🔔 Метка мигает для сотрудника (${user.position}):`, feedback.category);
        return true;
      }
      return false;
    }

    // Для обычных пользователей: мигать только если они рядом на 200 метров
    if (user && user.role === 'user' && userLocation) {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lon,
        feedback.lat,
        feedback.lon
      );
      if (distance <= 200) {
        console.log(`🔔 Метка мигает для пользователя (расстояние: ${Math.round(distance)}м):`, feedback.category);
        return true;
      }
      return false;
    }

    // Для неавторизованных пользователей: не мигать
    return false;
  };

  // Загрузка решений для жалобы
  const loadSolutions = async (feedbackId) => {
    try {
      const response = await fetch(`${API_URL}/api/solutions/${feedbackId}`);
      if (response.ok) {
        const data = await response.json();
        setSolutions(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки решений:', error);
    }
  };

  // Открытие модального окна просмотра жалобы
  const handleViewFeedback = (feedback) => {
    setSelectedFeedback(feedback);
    setShowViewModal(true);
    setCommentText(''); // Сбрасываем текст комментария
    if (feedback.status === 'resolved' || feedback.status === 'archived') {
      loadSolutions(feedback.id);
    }
  };

  // Создание решения
  const handleCreateSolution = async (e) => {
    e.preventDefault();
    
    if (!selectedFeedback) return;

    try {
      const token = localStorage.getItem('qm_token');
      if (!token) {
        alert('Необходимо войти в систему');
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('description', solutionFormData.description);
      if (solutionFormData.photo) {
        formDataToSend.append('photo', solutionFormData.photo);
      }

      const response = await fetch(`${API_URL}/api/solution/${selectedFeedback.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (response.ok) {
        const newSolution = await response.json();
        setSolutions([newSolution, ...solutions]);
        setSolutionFormData({ description: '', photo: null });
        setShowSolutionModal(false);
        
        // Обновляем жалобу
        const updatedFeedback = { ...selectedFeedback, status: 'resolved' };
        setSelectedFeedback(updatedFeedback);
        setFeedbacks(prev => prev.map(f => f.id === updatedFeedback.id ? updatedFeedback : f));
        
        alert('Решение успешно создано!');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка при создании решения' }));
        alert(errorData.error || 'Ошибка при создании решения');
      }
    } catch (error) {
      console.error('Ошибка при создании решения:', error);
      alert('Ошибка при создании решения');
    }
  };

  // Лайк решения
  const handleLikeSolution = async (solutionId) => {
    try {
      const token = localStorage.getItem('qm_token');
      if (!token) {
        alert('Необходимо войти в систему');
        return;
      }

      const response = await fetch(`${API_URL}/api/solutions/${solutionId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const updatedSolution = await response.json();
        setSolutions(prev => prev.map(s => s.id === updatedSolution.id ? updatedSolution : s));
        
        // Если лайков >= 5, обновляем жалобу
        if (updatedSolution.likes >= 5) {
          const updatedFeedback = { ...selectedFeedback, status: 'archived' };
          setSelectedFeedback(updatedFeedback);
          setFeedbacks(prev => prev.map(f => f.id === updatedFeedback.id ? updatedFeedback : f));
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка при лайке решения' }));
        alert(errorData.error || 'Ошибка при лайке решения');
      }
    } catch (error) {
      console.error('Ошибка при лайке решения:', error);
      alert('Ошибка при лайке решения');
    }
  };

  const handleAddFeedback = async (e) => {
    e.preventDefault();
    
    // Валидация формы
    if (!formData.title || !formData.title.trim()) {
      alert('Введите заголовок жалобы');
      return;
    }
    
    if (!formData.address || !formData.address.trim()) {
      alert('Введите адрес или выберите место на карте');
      return;
    }
    
    if (!newFeedbackLocation) {
      alert('Выберите место на карте или введите адрес');
      return;
    }
    
    if (!formData.categories || formData.categories.length === 0) {
      alert('Выберите хотя бы одну категорию');
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('address', formData.address);
      // Отправляем первую категорию (можно расширить для множественного выбора)
      formDataToSend.append('category', formData.categories[0] || 'other');
      formDataToSend.append('lat', newFeedbackLocation.lat);
      formDataToSend.append('lon', newFeedbackLocation.lon);
      formDataToSend.append('is_anonymous', formData.is_anonymous ? 'true' : 'false');
      
      if (formData.photo) {
        formDataToSend.append('photo', formData.photo);
      }
      if (formData.video) {
        formDataToSend.append('video', formData.video);
      }

      const token = localStorage.getItem('qm_token');
      const response = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: formDataToSend
      });

      if (response.ok) {
        const newFeedback = await response.json();
        console.log('✅ Новый фидбек создан:', newFeedback);
        console.log('📋 Выбранные категории:', selectedCategories);
        console.log('📋 Категория нового фидбека:', newFeedback.category);
        
        // Отмечаем как новую для мигающей метки
        newFeedback.is_new = true;
        
        // Если категория нового фидбека не выбрана, добавляем её в выбранные
        if (!selectedCategories.includes('all') && !selectedCategories.includes(newFeedback.category)) {
          console.log('⚠️ Категория нового фидбека не выбрана, добавляем её');
          setSelectedCategories(prev => [...prev, newFeedback.category]);
        }
        
        // Добавляем в состояние
        setFeedbacks(prev => {
          // Проверяем, нет ли уже такой жалобы
          const exists = prev.find(f => f.id === newFeedback.id);
          if (exists) {
            console.log('⚠️ Фидбек уже существует в состоянии');
            return prev;
          }
          console.log('📝 Добавляем новый фидбек в состояние, всего:', prev.length + 1);
          return [newFeedback, ...prev];
        });
        
        setShowAddModal(false);
        resetForm();
        
        // Маркеры обновятся автоматически через useEffect при изменении feedbacks
      } else {
        try {
          const errorData = await response.json();
          alert(`Ошибка: ${errorData.error || 'Не удалось добавить жалобу'}`);
        } catch (parseError) {
          alert('Ошибка: Не удалось добавить жалобу');
        }
      }
    } catch (error) {
      console.error('Ошибка при добавлении жалобы:', error);
      alert('Ошибка при добавлении жалобы. Попробуйте еще раз.');
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, [type]: file }));
    }
  };

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories(prev => {
      if (categoryId === 'all') {
        return ['all'];
      }
      const newCategories = prev.filter(c => c !== 'all');
      if (newCategories.includes(categoryId)) {
        const filtered = newCategories.filter(c => c !== categoryId);
        return filtered.length === 0 ? ['all'] : filtered;
      } else {
        return [...newCategories, categoryId];
      }
    });
  };

  const handleProfileClick = () => {
    setShowProfile(true);
  };

  const handleCityChange = (cityId) => {
    setSelectedCity(cityId);
    setSelectedDistrict('all');
  };

  const handleMapStyleChange = (style) => {
    setMapStyle(style);
    if (mapInstanceRef.current) {
      updateMapType(mapInstanceRef.current, style);
    }
  };

  // Функция для центрирования карты на местоположении пользователя
  const handleGeolocationClick = () => {
    if (!mapInstanceRef.current || !userLocation) return;

    // Запрашиваем актуальное местоположение
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          // Обновляем местоположение пользователя
          setUserLocation({
            lat,
            lon,
            name: 'Ваше местоположение'
          });

          // Центрируем карту на местоположении пользователя
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter([lat, lon], 17, {
              duration: 500
            });
            
            // Обновляем маркер местоположения
            addUserLocationMarker();
          }
        },
        (error) => {
          console.error('Ошибка получения геолокации:', error);
          // Если не удалось получить новое местоположение, используем сохраненное
          if (userLocation && mapInstanceRef.current) {
            mapInstanceRef.current.setCenter([userLocation.lat, userLocation.lon], 17, {
              duration: 500
            });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      // Если геолокация недоступна, просто центрируем на сохраненном местоположении
      if (userLocation && mapInstanceRef.current) {
        mapInstanceRef.current.setCenter([userLocation.lat, userLocation.lon], 17, {
          duration: 500
        });
      }
    }
  };

  const openAddModal = () => {
    if (activeTab === 'map' && mapInstanceRef.current) {
      const center = mapInstanceRef.current.getCenter();
      setNewFeedbackLocation({
        lat: center[0],
        lon: center[1]
      });
    }
    setShowAddModal(true);
  };

  const handleAddressSearch = () => {
    if (!formData.address || !mapInstanceRef.current || !window.ymaps) return;
    
    // Используем геокодер Яндекс.Карт для поиска адреса
    window.ymaps.geocode(formData.address).then((res) => {
      const firstGeoObject = res.geoObjects.get(0);
      if (firstGeoObject) {
        const coords = firstGeoObject.geometry.getCoordinates();
        setNewFeedbackLocation({
          lat: coords[0],
          lon: coords[1]
        });
        mapInstanceRef.current.setCenter(coords, 15);
        
        // Добавляем временную метку
        if (mapInstanceRef.current) {
          const tempMarker = new window.ymaps.Placemark(coords, {
            hintContent: formData.address
          }, {
            preset: 'islands#redCircleDotIcon'
          });
          mapInstanceRef.current.geoObjects.add(tempMarker);
          
          // Удаляем метку через 5 секунд
          setTimeout(() => {
            mapInstanceRef.current.geoObjects.remove(tempMarker);
          }, 5000);
        }
      } else {
        alert('Адрес не найден');
      }
    });
  };

  // Фильтрация жалоб для списка
  const filteredFeedbacks = feedbacks
    .filter(feedback => {
      // Фильтр по категориям
      const categoryMatch = selectedCategories.includes('all') || selectedCategories.includes(feedback.category);
      
      // Фильтр по поисковому запросу
      const searchMatch = !searchQuery || 
        feedback.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feedback.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return categoryMatch && searchMatch;
    })
    .sort((a, b) => {
      // Сортировка по лайкам
      if (sortByLikes === 'most-likes') {
        return (b.votes || 0) - (a.votes || 0);
      } else if (sortByLikes === 'least-likes') {
        return (a.votes || 0) - (b.votes || 0);
      }
      // По умолчанию - по дате создания (новые сначала)
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const currentCity = CITIES.find(c => c.id === selectedCity) || CITIES[0];

  return (
    <div className={`map-page ${!isAuthenticatedState ? 'blurred' : ''} ${showProfile ? 'profile-open' : ''}`}>
      {/* Логин оверлей */}
      {!isAuthenticatedState && (
        <LoginOverlay onLoginSuccess={handleLoginSuccess} />
      )}

      {/* Верхняя панель */}
      <div className={`map-header ${!isAuthenticatedState ? 'disabled' : ''}`}>
        {/* Бургер-меню для мобильных - только во вкладке "Карта", вместо профиля */}
        {activeTab === 'map' && (
          <div className="mobile-burger-wrapper">
            <MobileFilters
              cities={CITIES}
              selectedCity={selectedCity}
              onCityChange={handleCityChange}
              selectedDistrict={selectedDistrict}
              onDistrictChange={setSelectedDistrict}
              currentCity={currentCity}
              categories={CATEGORIES}
              selectedCategories={selectedCategories}
              onCategoryToggle={handleCategoryToggle}
            />
          </div>
        )}

        {/* Кнопка профиля - всегда в левом верхнем углу на уровне вкладок */}
        <button 
          className="profile-button"
          onClick={handleProfileClick}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Колокольчик уведомлений */}
        <div className="header-notifications">
          <NotificationBell />
        </div>

        <div className="header-content">
          <div className="tabs-container">
            <button
              className={`tab-button ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              Карта
            </button>
            <button
              className={`tab-button ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              Жалобы
            </button>
          </div>
        </div>

        {/* Фильтр и поиск для вкладки Жалобы - под вкладками */}
        {activeTab === 'list' && (
          <>
            <div className="list-filters">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Поиск жалоб..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="list-sort-filter">
                <label className="sort-label">Сортировка по лайкам:</label>
                <select 
                  value={sortByLikes} 
                  onChange={(e) => setSortByLikes(e.target.value)}
                  className="sort-select"
                >
                  <option value="none">По умолчанию (новые сначала)</option>
                  <option value="most-likes">Больше всего лайков</option>
                  <option value="least-likes">Меньше всего лайков</option>
                </select>
              </div>
              <div className="list-category-filter">
                <div className="list-category-checkboxes">
                  {CATEGORIES.map(cat => (
                    <label key={cat.id} className="list-category-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.id)}
                        onChange={() => handleCategoryToggle(cat.id)}
                      />
                      <span>{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button className="add-feedback-button" onClick={openAddModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Добавить жалобу
              </button>
            </div>
            <div className="list-container">
              <div className="feedbacks-list">
                {filteredFeedbacks.length === 0 ? (
                  <p className="empty-list">Жалоб пока нет</p>
                ) : (
                  filteredFeedbacks.map(feedback => (
                    <div 
                      key={feedback.id} 
                      className="feedback-item"
                      onClick={() => handleViewFeedback(feedback)}
                    >
                      <div className="feedback-item-header">
                        <h3>{feedback.title || 'Без названия'}</h3>
                        <span className="feedback-category">{getCategoryName(feedback.category)}</span>
                      </div>
                      <p className="feedback-description">{feedback.description || 'Нет описания'}</p>
                      <div className="feedback-item-footer">
                        <div className="feedback-author">
                          {feedback.is_anonymous ? (
                            <span className="post-anonymous-badge">Аноним</span>
                          ) : feedback.full_name ? (
                            <span className="feedback-view-author">{feedback.full_name}</span>
                          ) : feedback.username ? (
                            <span className="feedback-view-author">{feedback.username}</span>
                          ) : (
                            <span className="feedback-view-author">Гость</span>
                          )}
                        </div>
                        <div className="feedback-votes">
                          <button 
                            className="vote-button like-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVote(feedback.id, 'like');
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M7 22V11M2 13V20C2 21.1046 2.89543 22 4 22H16.4262C17.907 22 19.1662 20.9197 19.3914 19.4622L20.4683 12.4622C20.7479 10.6381 19.3411 9 17.5032 9H14C13.4477 9 13 8.55228 13 8V4.46584C13 3.10399 11.896 2 10.5342 2C10.2093 2 9.91498 2.1913 9.78306 2.48812L7.26394 8.5787C7.09896 8.94928 6.74594 9.2 6.35023 9.2H4C2.89543 9.2 2 10.0954 2 11.2V13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {feedback.votes || 0}
                          </button>
                          <button 
                            className="vote-button dislike-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVote(feedback.id, 'dislike');
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M17 2V13M22 11V4C22 2.89543 21.1046 2 20 2H7.57377C6.09296 2 4.83384 3.08029 4.60862 4.53777L3.53174 11.5378C3.2521 13.3619 4.65892 15 6.49677 15H10C10.5523 15 11 15.4477 11 16V19.5342C11 20.896 12.104 22 13.4658 22C13.7907 22 14.085 21.8087 14.2169 21.5119L16.7361 15.4213C16.901 15.0507 17.2541 14.8 17.6498 14.8H20C21.1046 14.8 22 13.9046 22 12.8V11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {feedback.dislikes || 0}
                          </button>
                        </div>
                        <span className="feedback-date">
                          {new Date(feedback.created_at).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* Селекторы города и района в правом верхнем углу */}
        {activeTab === 'map' && (
          <div className={`top-right-selectors ${!isAuthenticatedState ? 'disabled' : ''}`}>
            <div className="city-selector">
              <select 
                className="city-select"
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
              >
                {CITIES.map(city => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="district-selector">
              <select 
                className="district-select"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
              >
                <option value="all">Все районы</option>
                {currentCity.districts.map(district => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Категории в header */}
        {activeTab === 'map' && (
          <div className={`header-categories ${!isAuthenticatedState ? 'disabled' : ''}`}>
            <div className="category-filter-wrapper">
              <div className="category-filter-multi">
                <div className="category-checkboxes-vertical">
                  {CATEGORIES.map(cat => (
                    <label key={cat.id} className="category-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.id)}
                        onChange={() => handleCategoryToggle(cat.id)}
                      />
                      <span>{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Контент карты */}
      <div className="map-content">
        {activeTab === 'map' && (
          <>
            {!mapReady && (
              <div className="loading-overlay">
                <div className="loading-spinner"></div>
                <p>Загрузка карты...</p>
              </div>
            )}
            <div ref={mapRef} className="map-container" />
          </>
        )}
      </div>

      {/* Кнопки переключения стиля карты и геолокация */}
      {activeTab === 'map' && (
        <div className={`map-controls-bottom-right ${!isAuthenticatedState ? 'disabled' : ''}`}>
          {/* Кнопка геолокации */}
          <button 
            className="geolocation-button"
            onClick={handleGeolocationClick}
            title="Моё местоположение"
            disabled={!isAuthenticatedState}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="9" r="3" fill="currentColor"/>
            </svg>
          </button>
          
          <div className="map-style-controls">
            <button 
              className={`style-button ${mapStyle === 'map' ? 'active' : ''}`}
              onClick={() => handleMapStyleChange('map')}
              title="Детальная карта"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 7V17L9 20L15 17L21 20V10L15 7L9 10L3 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 10V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button 
              className={`style-button ${mapStyle === 'hybrid' ? 'active' : ''}`}
              onClick={() => handleMapStyleChange('hybrid')}
              title="Гибрид"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 18V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.93 4.93L7.76 7.76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16.24 16.24L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.93 19.07L7.76 16.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16.24 7.76L19.07 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно добавления жалобы */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false);
          resetForm();
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Добавить жалобу</h2>
              <button className="modal-close" onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddFeedback} className="feedback-form">
              <div className="form-main-content">
                <div className="form-left">
                  <div className="form-group">
                    <label>Адрес *</label>
                    <div className="address-input-group">
                      <input
                        ref={addressInputRef}
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Введите адрес или выберите на карте"
                        required
                      />
                      <button 
                        type="button" 
                        className="address-search-button"
                        onClick={handleAddressSearch}
                      >
                        Найти
                      </button>
                    </div>
                    {newFeedbackLocation && (
                      <p className="location-info">
                        Координаты: {newFeedbackLocation.lat.toFixed(6)}, {newFeedbackLocation.lon.toFixed(6)}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Заголовок *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                      placeholder="Введите заголовок жалобы"
                    />
                  </div>
                  <div className="form-group">
                    <label>Описание</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Опишите проблему"
                      rows="4"
                    />
                  </div>
                  <div className="form-group">
                    <label>Фото и Видео</label>
                    <div className="file-inputs-group">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, 'photo')}
                        className="file-input"
                      />
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        onChange={(e) => handleFileChange(e, 'video')}
                        className="file-input"
                      />
                    </div>
                  </div>
                </div>
                <div className="form-right">
                  <div className="form-group">
                    <label>Категории * (можно выбрать несколько)</label>
                    <div className="category-checkboxes-form-vertical">
                      {CATEGORIES.map(cat => (
                        <label key={cat.id} className="category-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.categories.includes(cat.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({ ...prev, categories: [...prev.categories, cat.id] }));
                              } else {
                                setFormData(prev => ({ ...prev, categories: prev.categories.filter(c => c !== cat.id) }));
                              }
                            }}
                          />
                          <span>{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {currentUser?.role === 'user' && (
                <div className="form-group anonymous-checkbox">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_anonymous}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_anonymous: e.target.checked }))}
                    />
                    <span>Опубликовать анонимно</span>
                  </label>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}>
                  Отмена
                </button>
                <button type="submit" className="submit-button">
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра жалобы */}
      {showViewModal && selectedFeedback && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedFeedback.title || 'Без названия'}</h2>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="feedback-view">
              <div className="feedback-view-category">
                {getCategoryName(selectedFeedback.category)}
              </div>
              <div className="feedback-view-author">
                Автор: {selectedFeedback.is_anonymous 
                  ? 'Аноним' 
                  : (selectedFeedback.full_name 
                    ? selectedFeedback.full_name 
                    : (selectedFeedback.username 
                      ? selectedFeedback.username 
                      : (selectedFeedback.user_id ? 'Пользователь' : 'Гость')))}
              </div>
              {selectedFeedback.description && (
                <p className="feedback-view-description">{selectedFeedback.description}</p>
              )}
              {selectedFeedback.photo_url && (
                <img 
                  src={`${API_URL}${selectedFeedback.photo_url}`} 
                  alt={selectedFeedback.title}
                  className="feedback-view-photo"
                />
              )}
              {selectedFeedback.video_url && (
                <video 
                  src={`${API_URL}${selectedFeedback.video_url}`} 
                  controls
                  className="feedback-view-video"
                />
              )}
              <div className="feedback-view-footer">
                <div className="vote-buttons">
                  <button 
                    className={`like-button ${userVotes[selectedFeedback.id] === 'like' ? 'active' : ''}`}
                    onClick={() => handleLike(selectedFeedback.id)}
                  >
                    👍 {selectedFeedback.votes || 0}
                  </button>
                  <button 
                    className={`dislike-button ${userVotes[selectedFeedback.id] === 'dislike' ? 'active' : ''}`}
                    onClick={() => handleDislike(selectedFeedback.id)}
                  >
                    👎 {selectedFeedback.dislikes || 0}
                  </button>
                </div>
              </div>
              {selectedFeedback.created_at && (
                <p className="feedback-view-date">
                  Создано: {new Date(selectedFeedback.created_at).toLocaleString('ru-RU')}
                </p>
              )}
              
              {/* Кнопки для сотрудников */}
              {user && user.role === 'employee' && 
               selectedFeedback.status !== 'completed' &&
               selectedFeedback.status !== 'resolved' && 
               selectedFeedback.status !== 'archived' && (
                <div className="feedback-solve-section">
                  {!canEmployeeSolveFeedback(selectedFeedback) ? (
                    <p className="category-warning">
                      ⚠️ Вы не можете решать проблемы этой категории. 
                      {user.position && (
                        <span> Ваша должность ({user.position}) позволяет решать только: {
                          (POSITION_TO_CATEGORIES[user.position] || []).map(cat => {
                            const category = CATEGORIES.find(c => c.id === cat);
                            return category ? category.name : cat;
                          }).join(', ')
                        }</span>
                      )}
                    </p>
                  ) : isEmployeeNearFeedback(selectedFeedback) ? (
                    <>
                      <button 
                        className="solve-button"
                        onClick={() => setShowSolutionModal(true)}
                      >
                        🧰 Решить проблему (с фото)
                      </button>
                      <button 
                        className="complete-button"
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('qm_token');
                            if (!token) {
                              alert('Необходимо войти в систему');
                              return;
                            }

                            const response = await fetch(`${API_URL}/api/employee/complete/${selectedFeedback.id}`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                              }
                            });

                            if (response.ok) {
                              const result = await response.json();
                              setSelectedFeedback(result.feedback);
                              setFeedbacks(prev => prev.map(f => f.id === result.feedback.id ? result.feedback : f));
                              alert('Задача отмечена как выполненная!');
                            } else {
                              const errorData = await response.json().catch(() => ({ error: 'Ошибка при завершении задачи' }));
                              alert(errorData.error || 'Ошибка при завершении задачи');
                            }
                          } catch (error) {
                            console.error('Ошибка при завершении задачи:', error);
                            alert('Ошибка при завершении задачи');
                          }
                        }}
                      >
                        ✅ Отметить решено
                      </button>
                    </>
                  ) : (
                    <p className="distance-warning">Вы находитесь слишком далеко от проблемы. Подойдите ближе (в радиусе 500м).</p>
                  )}
                </div>
              )}

              {/* Отображение решений */}
              {(selectedFeedback.status === 'resolved' || selectedFeedback.status === 'archived') && solutions.length > 0 && (
                <div className="solutions-section">
                  <h3>Решения:</h3>
                  {solutions.map(solution => (
                    <div key={solution.id} className="solution-item">
                      {solution.photo_url && (
                        <img 
                          src={`${API_URL}${solution.photo_url}`} 
                          alt="Решение"
                          className="solution-photo"
                        />
                      )}
                      {solution.description && (
                        <p className="solution-description">{solution.description}</p>
                      )}
                      <div className="solution-footer">
                        <span className="solution-author">
                          Сотрудник: {solution.full_name || solution.username || 'Неизвестно'}
                        </span>
                        <button 
                          className="solution-like-button"
                          onClick={() => handleLikeSolution(solution.id)}
                        >
                          👍 {solution.likes || 0}
                        </button>
                      </div>
                      <p className="solution-date">
                        {new Date(solution.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Форма для добавления комментария */}
              <div className="feedback-comment-section">
                <h3>Комментарий</h3>
                {selectedFeedback.comment && (
                  <div className="feedback-comment-display">
                    <p>{selectedFeedback.comment}</p>
                  </div>
                )}
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!commentText.trim()) return;

                    try {
                      const token = localStorage.getItem('qm_token');
                      const response = await fetch(`${API_URL}/api/feedback/${selectedFeedback.id}/comment`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token && { 'Authorization': `Bearer ${token}` })
                        },
                        body: JSON.stringify({ comment: commentText.trim() })
                      });

                      if (response.ok) {
                        const updated = await response.json();
                        setSelectedFeedback(updated);
                        setFeedbacks(prev => prev.map(f => f.id === updated.id ? updated : f));
                        setCommentText('');
                        alert('Комментарий добавлен!');
                      } else {
                        const errorData = await response.json().catch(() => ({ error: 'Ошибка при добавлении комментария' }));
                        alert(errorData.error || 'Ошибка при добавлении комментария');
                      }
                    } catch (error) {
                      console.error('Ошибка при добавлении комментария:', error);
                      alert('Ошибка при добавлении комментария');
                    }
                  }}
                  className="comment-form"
                >
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Добавьте комментарий..."
                    rows="3"
                    className="comment-textarea"
                  />
                  <button type="submit" className="comment-submit-button">
                    Отправить комментарий
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания решения */}
      {showSolutionModal && selectedFeedback && (
        <div className="modal-overlay" onClick={() => setShowSolutionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Создать решение</h2>
              <button className="modal-close" onClick={() => setShowSolutionModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateSolution}>
              <div className="form-group">
                <label>Описание решения</label>
                <textarea
                  value={solutionFormData.description}
                  onChange={(e) => setSolutionFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Опишите, что было сделано..."
                  rows="4"
                />
              </div>
              <div className="form-group">
                <label>Фото результата</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSolutionFormData(prev => ({ ...prev, photo: e.target.files[0] }))}
                  className="file-input"
                />
              </div>
              <button type="submit" className="submit-button">
                Создать решение
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Профиль */}
      {showProfile && (
        <Profile 
          onClose={() => setShowProfile(false)}
          onViewFeedback={(feedback) => {
            setShowProfile(false);
            handleViewFeedback(feedback);
          }}
        />
      )}
    </div>
  );
};

export default MapPage;
