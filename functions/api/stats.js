// Cloudflare Pages Function: GET /api/stats?key=xxx
// 返回聚合好的访问统计，供 /stats/ 管理页读取

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  // --- 认证 ---
  if (!env.STATS_PASSWORD) {
    return json({ error: 'STATS_PASSWORD not configured on server' }, 500);
  }
  if (key !== env.STATS_PASSWORD) {
    return json({ error: 'Unauthorized. Add ?key=xxx to URL.' }, 401);
  }

  if (!env.DB) {
    return json({ error: 'D1 database not bound. See setup docs.' }, 500);
  }

  try {
    // 1. 总览
    const overall = await env.DB.prepare(
      `SELECT
         COUNT(*)                                         AS total_requests,
         COUNT(DISTINCT ip)                               AS unique_ips,
         COALESCE(SUM(input_tokens), 0)                   AS total_input_tokens,
         COALESCE(SUM(output_tokens), 0)                  AS total_output_tokens,
         COALESCE(AVG(elapsed_ms), 0)                     AS avg_elapsed_ms,
         SUM(CASE WHEN stage = 'success' THEN 1 ELSE 0 END) AS successful,
         SUM(CASE WHEN stage != 'success' THEN 1 ELSE 0 END) AS failed
       FROM chat_logs`
    ).first();

    // 2. 保留 IP + 国家分组，归属地取该组最近一次请求（不回填历史）。
    const perIp = await env.DB.prepare(
      `WITH located_logs AS (
         SELECT *, ROW_NUMBER() OVER (
           PARTITION BY ip, country
           ORDER BY ts DESC, COALESCE(city, '') DESC, COALESCE(region, '') DESC
         ) AS location_rank
         FROM chat_logs
       )
       SELECT
         ip,
         country,
         MAX(CASE WHEN location_rank = 1 THEN city END) AS city,
         MAX(CASE WHEN location_rank = 1 THEN region END) AS region,
         COUNT(*)                         AS requests,
         COALESCE(SUM(input_tokens), 0)   AS total_input,
         COALESCE(SUM(output_tokens), 0)  AS total_output,
         MIN(ts)                          AS first_seen,
         MAX(ts)                          AS last_seen,
         SUM(CASE WHEN stage != 'success' THEN 1 ELSE 0 END) AS errors
       FROM located_logs
       GROUP BY ip, country
       ORDER BY requests DESC
       LIMIT 100`
    ).all();

    // 3. 按国家
    const byCountry = await env.DB.prepare(
      `SELECT
         country,
         COUNT(*)            AS requests,
         COUNT(DISTINCT ip)  AS unique_ips
       FROM chat_logs
       GROUP BY country
       ORDER BY requests DESC`
    ).all();

    // 4. 最近 20 条（便于看最新活动）
    const recent = await env.DB.prepare(
      `SELECT ts, ip, country, city, region, model, input_tokens, output_tokens,
              elapsed_ms, history_len, stage, error
       FROM chat_logs
       ORDER BY ts DESC
       LIMIT 20`
    ).all();

    // 5. 按天分组（近 30 天）
    const daily = await env.DB.prepare(
      `SELECT
         DATE(ts / 1000, 'unixepoch')        AS day,
         COUNT(*)                            AS requests,
         COUNT(DISTINCT ip)                  AS unique_ips,
         COALESCE(SUM(input_tokens), 0)      AS input_tokens,
         COALESCE(SUM(output_tokens), 0)     AS output_tokens
       FROM chat_logs
       WHERE ts >= ?
       GROUP BY day
       ORDER BY day DESC`
    ).bind(Date.now() - 30 * 24 * 3600 * 1000).all();

    // 累计模型用量来自同一张日志表；保留旧模型历史，不推算未记录数据。
    const perModel = await env.DB.prepare(
      `SELECT model, COUNT(*) AS requests,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens
       FROM chat_logs
       GROUP BY model
       ORDER BY SUM(input_tokens) + SUM(output_tokens) DESC`
    ).all();

    return json({
      per_model: perModel.results,
      overall,
      per_ip: perIp.results,
      by_country: byCountry.results,
      recent: recent.results,
      daily: daily.results,
      generated_at: Date.now(),
    });
  } catch (e) {
    return json({ error: 'DB query failed', detail: String(e) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
