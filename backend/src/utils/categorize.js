/**
 * Функция для автоматической категоризации текста по ключевым словам
 * @param {string} text - Текст для анализа
 * @returns {string} - Название категории
 */
function categorize(text) {
  if (!text) return 'other';
  
  const lowerText = text.toLowerCase();
  
  // Категория "дорога" / "road"
  const roadKeywords = ['дорога', 'яма', 'выбоина', 'асфальт', 'тротуар', 'road', 'pothole'];
  if (roadKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'road';
  }
  
  // Категория "мусор" / "запах" → ecology
  const ecologyKeywords = ['мусор', 'запах', 'вонь', 'отходы', 'свалка', 'контейнер', 'trash', 'garbage', 'smell', 'экология', 'ecology'];
  if (ecologyKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'ecology';
  }
  
  // Категория "освещение" / "lighting"
  const lightingKeywords = ['фонарь', 'жарық', 'освещение', 'лампа', 'темнота', 'свет', 'light', 'lamp', 'dark', 'lighting'];
  if (lightingKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'lighting';
  }
  
  // По умолчанию
  return 'other';
}

module.exports = { categorize };

