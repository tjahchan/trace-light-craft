-- Delete bad TradeLocker imports for this user so corrected code can re-import
DELETE FROM trades WHERE user_id = '7d36b793-ebf6-4de9-bc27-8ecd0c6c4aac' AND tags @> ARRAY['tradelocker'];
DELETE FROM broker_activities_raw WHERE account_id = '5d08e603-195b-433c-af3e-e2c362f55c95' AND source_provider = 'tradelocker';
UPDATE broker_connections SET last_synced_at = NULL WHERE id = '6f3840b4-11b9-41a5-a500-2ed1a150263a';