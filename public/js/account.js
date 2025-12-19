// if (window.location.pathname.startsWith("/admin")) {
//   return; // ⛔ never redirect from admin pages
// }


router.get("/dashboard", adminAuth, (req, res) => {
  res.render("admin/dashboard", {
    title: "Admin Dashboard",
    admin: true,   // 🔴 THIS IS THE KEY
    user: req.user
  });
});
