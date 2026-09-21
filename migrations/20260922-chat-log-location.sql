-- 在部署城市统计代码之前执行一次；新增可空列，旧代码仍可写入。
-- 先用 PRAGMA table_info(chat_logs) 核对，若某列已存在，只执行缺失列。
ALTER TABLE chat_logs ADD COLUMN city TEXT;
ALTER TABLE chat_logs ADD COLUMN region TEXT;
