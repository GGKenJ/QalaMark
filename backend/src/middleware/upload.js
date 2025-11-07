const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Создаём папку uploads, если её нет
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Фильтр файлов (изображения и видео)
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedVideoTypes = /mp4|webm|ogg|mov/;
  const extname = path.extname(file.originalname).toLowerCase();
  
  if (file.fieldname === 'photo') {
    const isImage = allowedImageTypes.test(extname) && allowedImageTypes.test(file.mimetype);
    if (isImage) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (jpeg, jpg, png, gif, webp)'));
    }
  } else if (file.fieldname === 'video') {
    const isVideo = allowedVideoTypes.test(extname) && allowedVideoTypes.test(file.mimetype);
    if (isVideo) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только видео (mp4, webm, ogg, mov)'));
    }
  } else {
    cb(null, true);
  }
};

// Настройка multer для фото и видео
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: fileFilter
});

// Middleware для загрузки фото и видео
const uploadFields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

module.exports = { upload, uploadFields };
