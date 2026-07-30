import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sqlUrl = new URL("../supabase/operations_v3.sql", import.meta.url);

const functionBody = (sql, name) => {
  const pattern = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?as \\$function\\$(?<body>[\\s\\S]*?)\\$function\\$;`,
    "i",
  );
  return sql.match(pattern)?.groups?.body;
};

test("inventory adjustments delegate the stock update to one movement", async () => {
  const sql = (await readFile(sqlUrl, "utf8")).toLowerCase();
  const body = functionBody(sql, "adjust_inventory_stock");

  assert.ok(body, "adjust_inventory_stock must exist");
  assert.match(body, /insert\s+into\s+public\.inventory_movements/);
  assert.doesNotMatch(body, /update\s+public\.products/);
  assert.match(body, /p_new_stock\s*<\s*0/);
});

test("voiding a sale restores stock once and marks the sale voided", async () => {
  const sql = (await readFile(sqlUrl, "utf8")).toLowerCase();
  const body = functionBody(sql, "void_sale");

  assert.ok(body, "void_sale must exist");
  assert.match(body, /insert\s+into\s+public\.inventory_movements/);
  assert.match(body, /'adjustment_in'/);
  assert.match(body, /set\s+status\s*=\s*'voided'/);
  assert.doesNotMatch(body, /update\s+public\.products/);
});

test("cash close uses Chilean business dates and excludes voided sales", async () => {
  const sql = (await readFile(sqlUrl, "utf8")).toLowerCase();
  const body = functionBody(sql, "close_cash_day");

  assert.ok(body, "close_cash_day must exist");
  assert.match(body, /america\/santiago/);
  assert.match(body, /status\s*=\s*'completed'/);
  assert.match(body, /payment_method\s*=\s*'cash'/);
  assert.match(body, /on conflict\s*\(business_id,\s*business_date\)/);
});
