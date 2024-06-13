const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { ObjectId } = require("./db");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { id } = req.params;
    const destination =
      req.originalUrl === `/api/upload/chatrooms/${id}`
        ? path.join(__dirname, "..", "..", "uploads", "chatrooms", id)
        : path.join(__dirname, "..", "..", "uploads", "users", id);

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    cb(null, destination);
  },
  filename: function (req, file, cb) {
    const fileExtension = path.extname(file.originalname);
    const newFilename = `${new ObjectId()}${fileExtension}`;
    cb(null, newFilename);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 25, // 25MB max file size
  },
});
module.exports = { upload };
