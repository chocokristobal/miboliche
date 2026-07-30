import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sqlUrl = new URL(
  "../supabase/admin_and_weekly_goal_v5.sql",
  import.meta.url,
);

const functionBody = (sql, name) => {
  const pattern = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?as \\$function\\$(?<body>[\\s\\S]*?)\\$function\\$;`,
    "i",
  );
  return sql.match(pattern)?.groups?.body;
};

test("weekly goal has its own narrow write function", async () => {
  const sql = (await readFile(sqlUrl, "utf8")).toLowerCase();
  const body = functionBody(sql, "update_weekly_goal");

  assert.ok(body, "update_weekly_goal must exist");
  assert.match(body, /public\.is_business_writable\(p_business_id\)/);
  assert.match(body, /insert\s+into\s+public\.business_profiles/);
  assert.match(body, /weekly_goal\s*=\s*excluded\.weekly_goal/);
  assert.doesNotMatch(body, /update\s+public\.businesses/);
  assert.doesNotMatch(body, /update\s+public\.profiles/);
});

test("account role is resolved through a protected function", async () => {
  const sql = (await readFile(sqlUrl, "utf8")).toLowerCase();
  const body = functionBody(sql, "current_user_account_role");

  assert.ok(body, "current_user_account_role must exist");
  assert.match(body, /public\.is_platform_admin\(\)/);
  assert.match(
    sql,
    /grant execute on function public\.current_user_account_role\(\) to authenticated/,
  );
  assert.match(sql, /as correos_administradores/);
});
