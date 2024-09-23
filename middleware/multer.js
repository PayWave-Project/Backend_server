const multer = require("multer")

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./uploads")
    },

    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true)
    } else {
        cb(new Error("filetype not supported, Images only"), false)
    }
}

const fileSize = 1024 * 1024 * 4; // 4 MB file size limit

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: fileSize }
});

module.exports = { upload };