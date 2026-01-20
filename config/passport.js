const GoogleStrategy = require("passport-google-oauth20").Strategy;
const passport = require("passport");
const db = require("./db");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL

    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;

        // Check if user exists
        const [existing] = await db.query(
          "SELECT * FROM users WHERE email = ?",
          [email]
        );

        let user;

        if (existing.length > 0) {
          user = existing[0];
        } else {
          // Create user
          const [result] = await db.query(
  "INSERT INTO users (first_name, last_name, email, google_id, provider, is_admin) VALUES (?, ?, ?, ?, ?, 0)",
  [
    profile.name.givenName || "",
    profile.name.familyName || "",
    email,
    googleId,
    "google"
  ]
);


          const [rows] = await db.query(
            "SELECT * FROM users WHERE id = ?",
            [result.insertId]
          );

          user = rows[0];
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id); // store only user id
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    done(null, rows[0]);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
