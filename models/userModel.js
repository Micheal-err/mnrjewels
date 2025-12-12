const db = require("../config/db");

// Create user
exports.createUser = (data) => {
    return new Promise((resolve, reject) => {
        db.query(
            "INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)",
            [data.first_name, data.last_name, data.email, data.password],
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
    });
};

// Find user by email
exports.findByEmail = (email) => {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM users WHERE email = ?", [email], (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        });
    });
};

// Update user
exports.updateUser = (id, data) => {
    return new Promise((resolve, reject) => {
        db.query(
            "UPDATE users SET first_name=?, last_name=?, email=? WHERE id=?",
            [data.first_name, data.last_name, data.email, id],
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
    });
};

// Delete user
exports.deleteUser = (id) => {
    return new Promise((resolve, reject) => {
        db.query("DELETE FROM users WHERE id=?", [id], (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};
