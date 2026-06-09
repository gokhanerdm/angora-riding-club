-- Tüm üyeler için paketleri start_date sırasıyla çek,
-- toplam kullanılan dersi sıralı dağıt ve mevcut dağılımla karşılaştır.
-- Fark olan satırları döndür (düzeltme gereken paketler).
WITH pkg AS (
  SELECT
    m.id        AS member_id,
    m.name || ' ' || m.surname AS member_name,
    ms.id       AS ms_id,
    ms.start_date,
    ms.total_lessons,
    ms.used_lessons,
    ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY ms.start_date) AS rn,
    SUM(ms.used_lessons) OVER (PARTITION BY m.id ORDER BY ms.start_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_used,
    SUM(ms.total_lessons) OVER (PARTITION BY m.id ORDER BY ms.start_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_total,
    SUM(ms.total_lessons) OVER (PARTITION BY m.id ORDER BY ms.start_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_total
  FROM members m
  JOIN memberships ms ON ms.member_id = m.id
  WHERE m.deleted_at IS NULL
),
correct AS (
  SELECT *,
    COALESCE(prev_total, 0) AS pkg_start_at,
    -- Bu pakete doğru dolumda kaç ders düşer:
    GREATEST(0,
      LEAST(total_lessons,
        cumulative_used - COALESCE(prev_total, 0)
      )
    ) AS correct_used
  FROM pkg
)
SELECT
  member_name,
  ms_id,
  start_date,
  total_lessons,
  used_lessons   AS current_used,
  correct_used,
  (used_lessons - correct_used) AS diff
FROM correct
WHERE used_lessons <> correct_used
ORDER BY member_name, start_date;
