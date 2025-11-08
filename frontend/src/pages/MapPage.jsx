import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoginOverlay from '../components/LoginOverlay';
import MobileFilters from '../components/MobileFilters';
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

const MapPage = () => {
  const { isAuthenticated, checkAuth } = useAuth();
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
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [newFeedbackLocation, setNewFeedbackLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userVotes, setUserVotes] = useState({}); // { feedbackId: 'like' | 'dislike' | null }
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categories: [], // Множественный выбор категорий
    comment: '',
    photo: null,
    video: null,
    address: ''
  });
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

    // Фильтруем по категориям
    const filtered = selectedCategories.includes('all')
      ? feedbacks 
      : feedbacks.filter(f => selectedCategories.includes(f.category));

    filtered.forEach(feedback => {
      try {
        const category = CATEGORIES.find(c => c.id === feedback.category) || CATEGORIES[CATEGORIES.length - 1];
        const marker = new window.ymaps.Placemark(
          [feedback.lat, feedback.lon],
          {
            balloonContentHeader: feedback.title || 'Без названия',
            balloonContentBody: `${getCategoryName(feedback.category)}${feedback.description ? ': ' + feedback.description : ''}`,
            hintContent: feedback.title || 'Без названия'
          },
          {
            preset: `islands#${category.color}CircleDotIcon`,
            draggable: false
          }
        );

        marker.events.add('click', () => {
          setSelectedFeedback(feedback);
          setShowViewModal(true);
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

  const handleLike = async (id) => {
    const currentVote = userVotes[id];
    // Если уже лайкнул, убираем лайк
    if (currentVote === 'like') {
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
        body: JSON.stringify({ type: 'like' })
      });

      if (response.ok) {
        const updated = await response.json();
        setFeedbacks(prev => 
          prev.map(f => f.id === id ? updated : f)
        );
        if (selectedFeedback && selectedFeedback.id === id) {
          setSelectedFeedback(updated);
        }
        // Устанавливаем лайк и убираем дизлайк если был
        setUserVotes(prev => ({ ...prev, [id]: 'like' }));
      }
    } catch (error) {
      console.error('Ошибка при лайке:', error);
    }
  };

  const handleDislike = async (id) => {
    const currentVote = userVotes[id];
    // Если уже дизлайкнул, убираем дизлайк
    if (currentVote === 'dislike') {
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
        body: JSON.stringify({ type: 'dislike' })
      });

      if (response.ok) {
        const updated = await response.json();
        setFeedbacks(prev => 
          prev.map(f => f.id === id ? updated : f)
        );
        if (selectedFeedback && selectedFeedback.id === id) {
          setSelectedFeedback(updated);
        }
        // Устанавливаем дизлайк и убираем лайк если был
        setUserVotes(prev => ({ ...prev, [id]: 'dislike' }));
      }
    } catch (error) {
      console.error('Ошибка при дизлайке:', error);
    }
  };

  const handleAddFeedback = async (e) => {
    e.preventDefault();
    
    if (!newFeedbackLocation) {
      alert('Выберите место на карте или введите адрес');
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('comment', formData.comment);
      formDataToSend.append('address', formData.address);
      // Отправляем первую категорию (можно расширить для множественного выбора)
      formDataToSend.append('category', formData.categories[0] || 'other');
      formDataToSend.append('lat', newFeedbackLocation.lat);
      formDataToSend.append('lon', newFeedbackLocation.lon);
      
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
        setFeedbacks(prev => [...prev, newFeedback]);
        setShowAddModal(false);
        setFormData({
          title: '',
          description: '',
          categories: [],
          comment: '',
          photo: null,
          video: null,
          address: ''
        });
        setNewFeedbackLocation(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (videoInputRef.current) videoInputRef.current.value = '';
      } else {
        const errorData = await response.json();
        console.error('Ошибка добавления жалобы:', errorData);
        alert('Ошибка: ' + (errorData.error || 'Не удалось добавить жалобу'));
      }
    } catch (error) {
      console.error('Ошибка при добавлении жалобы:', error);
      alert('Ошибка при добавлении жалобы. Проверьте консоль для деталей.');
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
    console.log('Profile clicked');
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
  const filteredFeedbacks = feedbacks.filter(feedback => {
    // Фильтр по категориям
    const categoryMatch = selectedCategories.includes('all') || selectedCategories.includes(feedback.category);
    
    // Фильтр по поисковому запросу
    const searchMatch = !searchQuery || 
      feedback.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feedback.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return categoryMatch && searchMatch;
  });

  const currentCity = CITIES.find(c => c.id === selectedCity) || CITIES[0];

  return (
    <div className={`map-page ${!isAuthenticatedState ? 'blurred' : ''}`}>
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

        {/* Кнопка профиля - всегда в левом верхнем углу, скрыта на мобильных во вкладке "Карта" */}
        <button 
          className={`profile-button ${activeTab === 'map' ? 'hidden-on-mobile' : ''}`}
          onClick={handleProfileClick}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

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
        {activeTab === 'list' && (
          <div className="list-container">
            {/* Фильтр и поиск */}
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

            <div className="feedbacks-list">
              {filteredFeedbacks.length === 0 ? (
                <p className="empty-list">Жалоб пока нет</p>
              ) : (
                filteredFeedbacks.map(feedback => (
                  <div 
                    key={feedback.id} 
                    className="feedback-item"
                    onClick={() => {
                      setSelectedFeedback(feedback);
                      setShowViewModal(true);
                    }}
                  >
                    <div className="feedback-item-header">
                      <h3>{feedback.title || 'Без названия'}</h3>
                      <span className="feedback-category">{getCategoryName(feedback.category)}</span>
                    </div>
                    {feedback.description && (
                      <p className="feedback-description">{feedback.description}</p>
                    )}
                    <div className="feedback-item-footer">
                      <span className="feedback-votes">👍 {feedback.votes || 0} 👎 {feedback.dislikes || 0}</span>
                      <span className="feedback-date">
                        {feedback.created_at ? new Date(feedback.created_at).toLocaleDateString('ru-RU') : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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
          setFormData({
            title: '',
            description: '',
            categories: [],
            comment: '',
            photo: null,
            video: null,
            address: ''
          });
          setNewFeedbackLocation(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (videoInputRef.current) videoInputRef.current.value = '';
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Добавить жалобу</h2>
              <button className="modal-close" onClick={() => {
                setShowAddModal(false);
                setFormData({
                  title: '',
                  description: '',
                  categories: [],
                  comment: '',
                  photo: null,
                  video: null,
                  address: ''
                });
                setNewFeedbackLocation(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (videoInputRef.current) videoInputRef.current.value = '';
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
                  <div className="form-group">
                    <label>Комментарий</label>
                    <textarea
                      value={formData.comment}
                      onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                      placeholder="Добавьте комментарий..."
                      rows="3"
                    />
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
              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={() => {
                  setShowAddModal(false);
                  setFormData({
                    title: '',
                    description: '',
                    categories: [],
                    comment: '',
                    photo: null,
                    video: null,
                    address: ''
                  });
                  setNewFeedbackLocation(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  if (videoInputRef.current) videoInputRef.current.value = '';
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
              {selectedFeedback.comment && (
                <div className="feedback-comment">
                  <strong>Комментарий:</strong>
                  <p>{selectedFeedback.comment}</p>
                </div>
              )}
              {selectedFeedback.created_at && (
                <p className="feedback-view-date">
                  Создано: {new Date(selectedFeedback.created_at).toLocaleString('ru-RU')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;
