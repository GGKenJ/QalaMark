import { useState } from 'react';

const MobileFilters = ({ 
  cities, 
  selectedCity, 
  onCityChange, 
  selectedDistrict, 
  onDistrictChange, 
  currentCity,
  categories,
  selectedCategories,
  onCategoryToggle
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Бургер-кнопка */}
      <button 
        className="burger-menu-button"
        onClick={toggleMenu}
        aria-label="Открыть меню фильтров"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="burger-overlay" onClick={closeMenu}></div>
      )}

      {/* Drawer */}
      <div className={`burger-drawer ${isOpen ? 'open' : ''}`}>
        <div className="burger-drawer-header">
          <h2>Фильтры</h2>
          <button className="burger-close-button" onClick={closeMenu}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="burger-drawer-content">
          {/* Выбор города */}
          <div className="burger-filter-group">
            <label>Город</label>
            <select 
              className="burger-city-select"
              value={selectedCity}
              onChange={(e) => {
                onCityChange(e.target.value);
              }}
            >
              {cities.map(city => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          {/* Выбор района */}
          {currentCity && (
            <div className="burger-filter-group">
              <label>Район</label>
              <select 
                className="burger-district-select"
                value={selectedDistrict}
                onChange={(e) => onDistrictChange(e.target.value)}
              >
                <option value="all">Все районы</option>
                {currentCity.districts.map(district => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Категории */}
          <div className="burger-filter-group">
            <label>Категории</label>
            <div className="burger-category-checkboxes">
              {categories.map(cat => (
                <label key={cat.id} className="burger-category-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.id)}
                    onChange={() => onCategoryToggle(cat.id)}
                  />
                  <span>{cat.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileFilters;

