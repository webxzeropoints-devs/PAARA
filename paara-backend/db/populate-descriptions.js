const db = require('./database');

const products = db.prepare(`
  SELECT p.id, p.name, p.description, c.name AS category_name
  FROM products p
  JOIN categories c ON c.id = p.category_id
`).all();

const updateDescription = db.prepare(
  'UPDATE products SET description = ? WHERE id = ? AND (description IS NULL OR trim(description) = ? OR description NOT LIKE ?)'
);

const descriptionFor = (product) => {
  const name = String(product.name || '').trim();
  const words = name.toLowerCase();
  const category = String(product.category_name || '').toLowerCase();
  const isChain = words.includes('chain') || category.includes('chain');
  const isNecklace = words.includes('necklace') || category.includes('necklace');
  const isEarring = words.includes('earring') || category.includes('earring');
  const isPearl = words.includes('pearl');
  const isStone = words.includes('stone') || words.includes('diamond');
  const isDrop = words.includes('drop') || words.includes('dangle');
  const isHoop = words.includes('hoop');
  const isStud = words.includes('stud');

  let sentence;
  if (isPearl && (isNecklace || isEarring)) {
    sentence = `A graceful ${name} with a softly luminous pearl-inspired look, made to bring an elegant finishing touch to your styling.`;
  } else if (isStone && isEarring) {
    sentence = `A polished ${name} designed to catch the light with a refined, occasion-ready presence.`;
  } else if (isDrop && isEarring) {
    sentence = `A graceful ${name} with an elegant movement that adds a delicate statement to both everyday and occasion looks.`;
  } else if (isHoop && isEarring) {
    sentence = `A versatile ${name} with a clean silhouette, designed to bring an effortless glow to everyday styling.`;
  } else if (isStud && isEarring) {
    sentence = `A refined ${name} with a neat, understated profile that pairs beautifully with everyday and occasion wear.`;
  } else if (isChain || isNecklace) {
    sentence = `A considered ${name} with a clean, versatile silhouette, designed for effortless layering and everyday styling.`;
  } else if (isEarring) {
    sentence = `A distinctive ${name} designed to frame your look with a polished touch and effortless charm.`;
  } else {
    sentence = `A thoughtfully styled ${name} created to add a refined finishing touch to your jewellery collection.`;
  }
  return `Artificial Jewellery. ${sentence}`;
};

const migratedDescription = (product) => {
  const existing = String(product.description || '').trim();
  if (existing.startsWith('Artificial Jewellery')) return existing;
  if (existing && !existing.endsWith(' from the Paara collection.')) {
    return `Artificial Jewellery. ${existing}`;
  }
  return descriptionFor(product);
};

const migrate = db.transaction(() => {
  let updated = 0;
  products.forEach((product) => {
    const result = updateDescription.run(
      migratedDescription(product),
      product.id,
      '',
      'Artificial Jewellery%'
    );
    updated += result.changes;
  });
  return updated;
});

const updated = migrate();
console.log(`Updated ${updated} product descriptions; existing meaningful descriptions were preserved.`);
