import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sqlUrls = [
  new URL("../supabase/register_sale.sql", import.meta.url),
  new URL("../supabase/fix_sales_and_stock_v2.sql", import.meta.url),
];

test("register_sale delegates stock changes to the existing trigger chain", async () => {
  for (const sqlUrl of sqlUrls) {
    const sql = (await readFile(sqlUrl, "utf8")).toLowerCase();
    const functionBody = sql.match(
      /as \$function\$(?<body>[\s\S]*?)\$function\$;/,
    )?.groups?.body;

    assert.ok(functionBody, `${sqlUrl.pathname} must contain the function body`);

    assert.doesNotMatch(
      functionBody,
      /update\s+public\.products/,
      `${sqlUrl.pathname} must not update stock directly`,
    );
    assert.doesNotMatch(
      functionBody,
      /insert\s+into\s+public\.inventory_movements/,
      `${sqlUrl.pathname} must not create a second inventory movement`,
    );
    assert.match(
      functionBody,
      /insert\s+into\s+public\.sale_items/,
      `${sqlUrl.pathname} must insert sale items so the trigger chain can run`,
    );
    assert.match(
      functionBody,
      /group\s+by\s+parsed\.product_id/g,
      `${sqlUrl.pathname} must aggregate repeated cart rows by product`,
    );
    assert.match(
      functionBody,
      /v_constraint_name\s*=\s*constraint_name/,
      `${sqlUrl.pathname} must expose the failing integrity constraint`,
    );
  }
});

test("restocking creates one movement and does not also update stock directly", async () => {
  const productsUrl = new URL("../app/lib/products.ts", import.meta.url);
  const source = await readFile(productsUrl, "utf8");
  const functionBody = source.match(
    /export async function addProductStock\([\s\S]*?\n}\n/,
  )?.[0];

  assert.ok(functionBody, "addProductStock must exist");
  assert.match(
    functionBody,
    /\.from\("inventory_movements"\)\.insert/,
    "restocking must create one inventory movement",
  );
  assert.doesNotMatch(
    functionBody,
    /\.from\("products"\)\s*\.update/,
    "restocking must not also update stock directly",
  );
});
