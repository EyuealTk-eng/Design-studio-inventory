-- Sample items for local development (`supabase db reset` loads this).
insert into items (name, category, sku, location, condition, total_qty, available_qty, low_stock_threshold) values
  ('Arduino Uno R3', 'Microcontrollers', 'MC-001', 'Cabinet A, shelf 1', 'Good', 12, 12, 3),
  ('ESP32 DevKit', 'Microcontrollers', 'MC-002', 'Cabinet A, shelf 1', 'Good', 8, 8, 2),
  ('Raspberry Pi 4 (4 GB)', 'Microcontrollers', 'MC-003', 'Cabinet A, shelf 2', 'Good', 4, 4, 1),
  ('MAX30102 pulse oximeter sensor', 'Biosensors', 'BS-001', 'Drawer 3', 'New', 15, 15, 4),
  ('AD8232 ECG module', 'Biosensors', 'BS-002', 'Drawer 3', 'New', 6, 6, 2),
  ('MLX90614 IR temperature sensor', 'Biosensors', 'BS-003', 'Drawer 3', 'Good', 5, 5, 2),
  ('Digital multimeter', 'Test equipment', 'TE-001', 'Bench 2', 'Good', 6, 6, 2),
  ('Benchtop power supply 30 V', 'Test equipment', 'TE-002', 'Bench 1', 'Good', 3, 3, 1),
  ('2-channel oscilloscope', 'Test equipment', 'TE-003', 'Bench 1', 'Calibration due', 2, 2, 1),
  ('Soldering station', 'Tools', 'TL-001', 'Bench 3', 'Good', 4, 4, 1),
  ('Breadboard (830 points)', 'Consumables', 'CN-001', 'Bin 5', 'New', 30, 30, 8),
  ('Jumper wire kit', 'Consumables', 'CN-002', 'Bin 6', 'New', 20, 20, 5),
  ('PLA filament 1 kg (white)', '3D printing', 'PR-001', 'Printer room', 'New', 5, 5, 2),
  ('Disposable ECG electrodes (pack of 50)', 'Consumables', 'CN-003', 'Bin 7', 'New', 3, 3, 2);

insert into stock_movements (item_id, delta, reason)
select id, total_qty, 'added' from items;
