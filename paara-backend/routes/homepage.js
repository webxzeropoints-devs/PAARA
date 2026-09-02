const express = require('express');
const db = require('../db/database');
const publicImageUrl = require('../utils/publicImageUrl');
const router = express.Router();
router.get('/collection-tiles',(req,res)=>{
  const tiles=db.prepare('SELECT tile_key,label,subtitle,image_url,link_path FROM collection_tiles ORDER BY id').all();
  const productRows=db.prepare(`
    SELECT p.id,p.name,p.slug,tp.sort_order,
      COALESCE(primary_image.image_url, first_image.image_url) AS image_url
    FROM tile_products tp
    JOIN products p ON p.id=tp.product_id
    LEFT JOIN product_images primary_image
      ON primary_image.product_id=p.id AND primary_image.is_primary=1
    LEFT JOIN product_images first_image
      ON first_image.id=(SELECT id FROM product_images WHERE product_id=p.id ORDER BY sort_order ASC,id ASC LIMIT 1)
    WHERE tp.tile_key=?
    ORDER BY tp.sort_order,tp.id
  `);
  res.json(tiles.map(tile=>{const mapped=productRows.all(tile.tile_key).map((product) => ({ ...product, image_url: publicImageUrl(product.image_url) }));return {...tile,products:mapped,image_url:publicImageUrl(mapped[0]?.image_url||tile.image_url)};}));
});
router.get('/paara-irl',(req,res)=>{
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  const rows = db.prepare('SELECT id,image_url,owner_image_url,caption,updated_at,sort_order FROM paara_irl WHERE sort_order BETWEEN 0 AND 2 ORDER BY sort_order ASC, id ASC').all();
  res.json({ slots: rows.map((row) => ({ ...row, image_url: publicImageUrl(row.image_url) })), owner_image_url: publicImageUrl(rows[0]?.owner_image_url || '') });
});

router.get('/worn-by-you',(req,res)=>{
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const rows = db.prepare(`
    SELECT id, instagram_post_url, image_url, caption, likes, cached_at, updated_at
    FROM instagram_reviews
    WHERE product_id IS NULL AND sort_order BETWEEN 0 AND 2
    ORDER BY sort_order ASC, id ASC
    LIMIT 3
  `).all();
  res.json(rows.map((row) => ({ ...row, image_url: publicImageUrl(row.image_url) })));
});
module.exports=router;
