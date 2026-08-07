const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: "Bebidas",
    keywords: [
      "beverage", "beverages", "drink", "drinks", "bebida", "bebidas",
      "water", "agua", "juice", "jugo", "soda", "soft-drink",
      "coffee", "cafe", "tea", "té", "beer", "cerveza", "wine", "vino",
    ],
  },
  {
    category: "Lácteos",
    keywords: [
      "dairy", "milk", "leche", "yogurt", "yoghurt", "cheese", "queso",
      "butter", "mantequilla", "cream", "crema",
    ],
  },
  {
    category: "Panadería",
    keywords: [
      "bread", "pan", "bakery", "panaderia", "pastry", "pastries",
      "cake", "cakes", "torta", "galleta", "galletas", "cookie", "cookies",
    ],
  },
  {
    category: "Snacks y dulces",
    keywords: [
      "snack", "snacks", "chip", "chips", "chocolate", "chocolates",
      "candy", "candies", "dulce", "dulces", "confectionery",
    ],
  },
  {
    category: "Despensa",
    keywords: [
      "pasta", "rice", "arroz", "flour", "harina", "cereal", "cereals",
      "oil", "aceite", "sauce", "salsa", "spice", "spices", "condiment",
      "preserve", "conserva", "canned", "legume", "legumes",
    ],
  },
  {
    category: "Frutas y verduras",
    keywords: [
      "fruit", "fruits", "fruta", "frutas", "vegetable", "vegetables",
      "verdura", "verduras", "produce",
    ],
  },
  {
    category: "Carnes y congelados",
    keywords: [
      "meat", "carne", "chicken", "pollo", "fish", "pescado", "seafood",
      "marisco", "frozen", "congelado", "congelados",
    ],
  },
  {
    category: "Higiene y belleza",
    keywords: [
      "beauty", "cosmetic", "cosmetics", "hygiene", "higiene", "shampoo",
      "soap", "jabon", "toothpaste", "dental", "deodorant", "desodorante",
      "skincare", "skin-care",
    ],
  },
  {
    category: "Limpieza",
    keywords: [
      "cleaning", "limpieza", "detergent", "detergente", "bleach", "cloro",
      "disinfectant", "desinfectante", "dishwashing", "lavaloza",
    ],
  },
];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_:]/g, "-");

export function inferCategory(tags: string[], productName = ""): string {
  const searchable = [...tags, productName].map(normalize).join(" ");

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => searchable.includes(normalize(keyword)))) {
      return rule.category;
    }
  }

  return "Otros";
}
