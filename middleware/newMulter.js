const multer = require("multer");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = process.env.UPLOAD_PATH || '/tmp'; // Adjust based on environment
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else if (
        file.mimetype === "application/pdf" ||
        file.mimetype === "application/msword" ||
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        cb(null, true);
    } else {
        cb(new Error("Filetype not supported. Only images, PDF, and DOC/DOCX files are allowed"), false);
    }
};

const fileSize = 1024 * 1024 * 4; // 4 MB file size limit

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: fileSize }
});

module.exports = { upload };
