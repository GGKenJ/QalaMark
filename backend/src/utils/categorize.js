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
    return 'дорога';
  }
  
  // Категория "мусор" / "запах" → ecology
  const ecologyKeywords = ['мусор', 'запах', 'вонь', 'отходы', 'свалка', 'контейнер', 'trash', 'garbage', 'smell'];
  if (ecologyKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'мусор';
  }
  
  // Категория "освещение" / "lighting"
  const lightingKeywords = ['фонарь', 'жарық', 'освещение', 'лампа', 'темнота', 'свет', 'light', 'lamp', 'dark'];
  if (lightingKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'освещение';
  }
  
  // Категория "вода"
  const waterKeywords = ['вода', 'канализация', 'лужа', 'протечка', 'затопление', 'water', 'sewer', 'leak'];
  if (waterKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'вода';
  }
  
  // По умолчанию
  return 'другое';
}

module.exports = { categorize };

