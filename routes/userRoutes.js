const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
// const  changePassword  = require("../controllers/userController");
const  authMiddleware  = require("../middleware/authMiddleware");


// REGISTER
router.post("/register", userController.registerUser);
// LOGIN
router.post("/login", userController.loginUser);
// CHANGE PASSWORD
router.put("/change-password", authMiddleware, userController.changePassword);
router.get("/", userController.getUsers);
router.get("/:id", userController.getUserById);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

module.exports = router;
