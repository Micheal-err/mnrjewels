exports.searchProducts = async (req, res) => {
  const q = req.query.q?.trim();
  if (!q || q.length < 2) {
    return res.json({ success: true, products: [] });
  }

  const keyword = `%${q}%`;

  const [products] = await db.query(
    `
    SELECT 
      id,
      name,
      price,
      image1,
      category,
      sub_category,
      collection_name
    FROM products
    WHERE
      name LIKE ?
      OR category LIKE ?
      OR sub_category LIKE ?
      OR collection_name LIKE ?
    ORDER BY
      CASE
        WHEN name LIKE ? THEN 1
        WHEN collection_name LIKE ? THEN 2
        WHEN category LIKE ? THEN 3
        ELSE 4
      END
    LIMIT 12
    `,
    [
      keyword, // WHERE name
      keyword, // WHERE category
      keyword, // WHERE sub_category
      keyword, // WHERE collection_name
      keyword, // ORDER name
      keyword, // ORDER collection
      keyword  // ORDER category ✅ FIXED
    ]
  );

  res.json({ success: true, products });
};
