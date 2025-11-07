import { useState, useEffect, useRef } from 'react';
import './MapPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Список городов
const CITIES = [
  { id: 'kyzylorda', name: 'Кызылорда', lat: 45.0192, lon: 65.5083 },
  { id: 'almaty', name: 'Алматы', lat: 43.2220, lon: 76.8512 },
  { id: 'astana', name: 'Астана', lat: 51.1694, lon: 71.4491 },
  { id: 'shymkent', name: 'Шымкент', lat: 42.3419, lon: 69.5901 },
  { id: 'karaganda', name: 'Караганда', lat: 49.8014, lon: 73.1049 },
];

const MapPage = () => {
  const [activeTab, setActiveTab] = useState('map');
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCity, setSelectedCity] = useState('kyzylorda');
  const [userLocation, setUserLocation] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState('hybrid'); // hybrid, map, satellite
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [newFeedbackLocation, setNewFeedbackLocation] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    photo: null,
    video: null
  });
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Определение местоположения пользователя
  useEffect(() => {
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
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
    // Проверяем, не загружен ли уже скрипт
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

    // Загружаем Яндекс.Карты (без API ключа для базового использования)
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

        // Создаем карту Яндекс.Карт
        const map = new window.ymaps.Map(mapRef.current, {
          center: center,
          zoom: 15,
          controls: ['zoomControl', 'geolocationControl', 'typeSelector', 'fullscreenControl']
        }, {
          suppressMapOpenBlock: true,
          yandexMapAutoSwitch: true,
          yandexMapDisablePoiInteractivity: true
        });

        // Устанавливаем тип карты
        updateMapType(map, mapStyle);

        mapInstanceRef.current = map;
        
        // Добавляем маркер местоположения пользователя
        addUserLocationMarker();
        updateMarkers();

        // Обработчик двойного клика для добавления метки
        map.events.add('dblclick', (e) => {
          const coords = e.get('coords');
          setNewFeedbackLocation({
            lat: coords[0],
            lon: coords[1]
          });
          setShowAddModal(true);
        });

        // Обработчик клика на карту
        map.events.add('click', (e) => {
          // Закрываем балуны при клике на карту
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
  }, [feedbacks, selectedCategory, mapReady]);

  // Обновление типа карты
  const updateMapType = (map, style) => {
    switch (style) {
      case 'hybrid':
        map.setType('yandex#hybrid', { checkZoomRange: true });
        break;
      case 'map':
        map.setType('yandex#map', { checkZoomRange: true });
        break;
      case 'satellite':
        map.setType('yandex#satellite', { checkZoomRange: true });
        break;
      default:
        map.setType('yandex#hybrid', { checkZoomRange: true });
    }
  };

  // Обновление центра карты при смене города
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const city = CITIES.find(c => c.id === selectedCity);
    if (city) {
      mapInstanceRef.current.setCenter([city.lat, city.lon], 15, {
        duration: 500
      });
    }
  }, [selectedCity]);

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

    // Удаляем старые маркеры
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.geoObjects.remove(marker);
    });
    markersRef.current = [];

    const filtered = selectedCategory === 'all' 
      ? feedbacks 
      : feedbacks.filter(f => f.category === selectedCategory);

    filtered.forEach(feedback => {
      try {
        const markerColor = getMarkerColor(feedback.category);
        const marker = new window.ymaps.Placemark(
          [feedback.lat, feedback.lon],
          {
            balloonContentHeader: feedback.title || 'Без названия',
            balloonContentBody: `
              <div class="marker-popup">
                <p class="category">${getCategoryName(feedback.category)}</p>
                ${feedback.description ? `<p class="description">${feedback.description}</p>` : ''}
                <div class="popup-footer">
                  <span class="votes">👍 ${feedback.votes || 0}</span>
                  <button class="vote-button" data-id="${feedback.id}">Подтвердить</button>
                </div>
              </div>
            `,
            hintContent: feedback.title || 'Без названия'
          },
          {
            preset: `islands#${markerColor}CircleDotIcon`,
            draggable: false
          }
        );

        marker.events.add('click', () => {
          setSelectedFeedback(feedback);
          setShowViewModal(true);
        });

        mapInstanceRef.current.geoObjects.add(marker);
        markersRef.current.push(marker);

        // Обработчик кнопки "Подтвердить" в балуне
        marker.events.add('balloonopen', () => {
          const button = document.querySelector(`.vote-button[data-id="${feedback.id}"]`);
          if (button) {
            button.addEventListener('click', () => handleVote(feedback.id));
          }
        });
      } catch (error) {
        console.error('Ошибка добавления маркера:', error);
      }
    });
  };

  const getMarkerColor = (category) => {
    switch (category) {
      case 'road': return 'orange';
      case 'ecology': return 'green';
      case 'lighting': return 'yellow';
      default: return 'gray';
    }
  };

  const getCategoryName = (category) => {
    const names = {
      road: 'Дорога',
      ecology: 'Экология',
      lighting: 'Освещение',
      other: 'Другое'
    };
    return names[category] || 'Другое';
  };

  const handleVote = async (id) => {
    try {
      const token = localStorage.getItem('qm_token');
      const response = await fetch(`${API_URL}/api/feedback/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (response.ok) {
        const updated = await response.json();
        setFeedbacks(prev => 
          prev.map(f => f.id === id ? updated : f)
        );
        if (selectedFeedback && selectedFeedback.id === id) {
          setSelectedFeedback(updated);
        }
      }
    } catch (error) {
      console.error('Ошибка при голосовании:', error);
    }
  };

  const handleAddFeedback = async (e) => {
    e.preventDefault();
    
    if (!newFeedbackLocation) return;

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('category', formData.category);
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
          category: 'other',
          photo: null,
          video: null
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

  const handleProfileClick = () => {
    console.log('Profile clicked');
  };

  const handleCityChange = (cityId) => {
    setSelectedCity(cityId);
  };

  const handleMapStyleChange = (style) => {
    setMapStyle(style);
    if (mapInstanceRef.current) {
      updateMapType(mapInstanceRef.current, style);
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

  const filteredFeedbacks = selectedCategory === 'all' 
    ? feedbacks 
    : feedbacks.filter(f => f.category === selectedCategory);

  return (
    <div className="map-page">
      {/* Верхняя панель */}
      <div className="map-header">
        <button className="profile-button" onClick={handleProfileClick}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

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

      {/* Фильтры */}
      {activeTab === 'map' && (
        <div className="filters-container">
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

          <div className="category-filter-wrapper">
            <select 
              className="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">Все категории</option>
              <option value="road">Дорога</option>
              <option value="ecology">Экология</option>
              <option value="lighting">Освещение</option>
              <option value="other">Другое</option>
            </select>
          </div>
        </div>
      )}

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
            <div className="list-header">
              <h2>Жалобы</h2>
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
                      <span className="feedback-votes">👍 {feedback.votes || 0}</span>
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

      {/* Кнопки переключения стиля карты */}
      {activeTab === 'map' && (
        <div className="map-style-controls">
          <button 
            className={`style-button ${mapStyle === 'map' ? 'active' : ''}`}
            onClick={() => handleMapStyleChange('map')}
            title="Схема"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 11C13.1046 11 14 10.1046 14 9C14 7.89543 13.1046 7 12 7C10.8954 7 10 7.89543 10 9C10 10.1046 10.8954 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button 
            className={`style-button ${mapStyle === 'hybrid' ? 'active' : ''}`}
            onClick={() => handleMapStyleChange('hybrid')}
            title="Гибрид"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button 
            className={`style-button ${mapStyle === 'satellite' ? 'active' : ''}`}
            onClick={() => handleMapStyleChange('satellite')}
            title="Спутник"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 6V18M6 12H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Модальное окно добавления жалобы */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false);
          setFormData({
            title: '',
            description: '',
            category: 'other',
            photo: null,
            video: null
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
                  category: 'other',
                  photo: null,
                  video: null
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
                <label>Категория *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  required
                >
                  <option value="road">Дорога</option>
                  <option value="ecology">Экология</option>
                  <option value="lighting">Освещение</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div className="form-group">
                <label>Фото</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'photo')}
                />
                {formData.photo && (
                  <div className="file-preview">
                    <img src={URL.createObjectURL(formData.photo)} alt="Preview" />
                    <span>{formData.photo.name}</span>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Видео</label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileChange(e, 'video')}
                />
                {formData.video && (
                  <div className="file-preview">
                    <video src={URL.createObjectURL(formData.video)} controls />
                    <span>{formData.video.name}</span>
                  </div>
                )}
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={() => {
                  setShowAddModal(false);
                  setFormData({
                    title: '',
                    description: '',
                    category: 'other',
                    photo: null,
                    video: null
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
                <span className="feedback-view-votes">👍 {selectedFeedback.votes || 0}</span>
                <button 
                  className="vote-button"
                  onClick={() => handleVote(selectedFeedback.id)}
                >
                  Подтвердить
                </button>
              </div>
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
